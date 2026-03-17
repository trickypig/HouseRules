using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HouseRules.PageModels;

[QueryProperty(nameof(ListId), "listId")]
public partial class ShoppingListDetailPageModel : ObservableObject
{
    private readonly ApiClient _api;
    private readonly AuthService _auth;
    private CancellationTokenSource? _autocompleteCts;

    [ObservableProperty] private int _listId;
    [ObservableProperty] private string _pageTitle = "Shopping List";
    [ObservableProperty] private ShoppingList? _shoppingList;
    [ObservableProperty] private bool _isBusy;
    [ObservableProperty] private bool _isRefreshing;

    // Add item form
    [ObservableProperty] private string _newItemText = string.Empty;
    [ObservableProperty] private string _newItemQuantity = string.Empty;
    [ObservableProperty] private string _newItemNotes = string.Empty;

    // Autocomplete
    [ObservableProperty] private bool _showSuggestions;
    public ObservableCollection<string> Suggestions { get; } = [];

    // Separate sections
    public ObservableCollection<ShoppingListItem> UnpurchasedItems { get; } = [];
    public ObservableCollection<ShoppingListItem> PurchasedItems { get; } = [];

    public ShoppingListDetailPageModel(ApiClient api, AuthService auth)
    {
        _api = api;
        _auth = auth;
    }

    partial void OnListIdChanged(int value)
    {
        if (value > 0) LoadDataCommand.Execute(null);
    }

    partial void OnNewItemTextChanged(string value)
    {
        _autocompleteCts?.Cancel();
        if (value.Length < 2)
        {
            Suggestions.Clear();
            ShowSuggestions = false;
            return;
        }

        _autocompleteCts = new CancellationTokenSource();
        var token = _autocompleteCts.Token;
        _ = AutocompleteAsync(value, token);
    }

    private async Task AutocompleteAsync(string query, CancellationToken token)
    {
        try
        {
            await Task.Delay(300, token);
            if (token.IsCancellationRequested) return;
            var result = await _api.AutocompleteShoppingItemAsync(query);
            if (token.IsCancellationRequested) return;
            Suggestions.Clear();
            foreach (var s in result.Suggestions) Suggestions.Add(s);
            ShowSuggestions = Suggestions.Count > 0;
        }
        catch (TaskCanceledException) { }
        catch { Suggestions.Clear(); ShowSuggestions = false; }
    }

    [RelayCommand]
    private void SelectSuggestion(string suggestion)
    {
        NewItemText = suggestion;
        ShowSuggestions = false;
        Suggestions.Clear();
    }

    [RelayCommand]
    private async Task GoBackAsync()
    {
        await Shell.Current.GoToAsync("..");
    }

    [RelayCommand]
    private async Task LoadDataAsync()
    {
        if (IsBusy || ListId <= 0) return;
        IsBusy = true;
        try
        {
            var data = await _api.GetShoppingItemsAsync(ListId);
            ShoppingList = data.List;
            PageTitle = data.List?.Name ?? "Shopping List";

            UnpurchasedItems.Clear();
            PurchasedItems.Clear();
            foreach (var item in data.Items)
            {
                if (item.IsPurchased != 0)
                    PurchasedItems.Add(item);
                else
                    UnpurchasedItems.Add(item);
            }
        }
        catch (UnauthorizedAccessException) { }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
        finally
        {
            IsBusy = false;
            IsRefreshing = false;
        }
    }

    [RelayCommand]
    private async Task AddItemAsync()
    {
        if (string.IsNullOrWhiteSpace(NewItemText)) return;
        try
        {
            await _api.AddShoppingItemAsync(ListId, NewItemText.Trim(),
                quantity: string.IsNullOrWhiteSpace(NewItemQuantity) ? null : NewItemQuantity.Trim(),
                notes: string.IsNullOrWhiteSpace(NewItemNotes) ? null : NewItemNotes.Trim());
            NewItemText = string.Empty;
            NewItemQuantity = string.Empty;
            NewItemNotes = string.Empty;
            ShowSuggestions = false;
            await LoadDataAsync();
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task ToggleItemAsync(ShoppingListItem item)
    {
        try { await _api.ToggleShoppingItemAsync(item.Id); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task DeleteItemAsync(ShoppingListItem item)
    {
        // Kids can only delete items they added
        if (_auth.IsKid && item.AddedByUserId != _auth.User?.Id) return;
        try { await _api.DeleteShoppingItemAsync(item.Id); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    public bool CanDeleteItem(ShoppingListItem item)
    {
        return !_auth.IsKid || item.AddedByUserId == _auth.User?.Id;
    }
}
