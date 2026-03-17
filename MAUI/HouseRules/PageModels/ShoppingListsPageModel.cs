using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HouseRules.PageModels;

public partial class ShoppingListsPageModel : ObservableObject
{
    private readonly ApiClient _api;

    [ObservableProperty] private bool _isBusy;
    [ObservableProperty] private bool _isRefreshing;

    public ObservableCollection<ShoppingList> Lists { get; } = [];

    public ShoppingListsPageModel(ApiClient api)
    {
        _api = api;
    }

    [RelayCommand]
    private async Task LoadDataAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            var data = await _api.GetShoppingListsAsync();
            Lists.Clear();
            foreach (var list in data.Lists) Lists.Add(list);
        }
        catch (UnauthorizedAccessException) { }
        catch (Exception ex)
        {
            
                await AppShell.DisplaySnackbarAsync(ex.Message);
        }
        finally
        {
            IsBusy = false;
            IsRefreshing = false;
        }
    }

    [RelayCommand]
    private async Task CreateListAsync()
    {
        var name = await Shell.Current.DisplayPromptAsync("New List", "Enter list name:");
        if (string.IsNullOrWhiteSpace(name)) return;

        try
        {
            await _api.CreateShoppingListAsync(name);
            await LoadDataAsync();
        }
        catch (Exception ex)
        {
            
                await AppShell.DisplaySnackbarAsync(ex.Message);
        }
    }

    [RelayCommand]
    private async Task DeleteListAsync(ShoppingList list)
    {
        var confirm = await Shell.Current.DisplayAlertAsync("Delete", $"Delete list '{list.Name}'?", "Delete", "Cancel");
        if (!confirm) return;

        try
        {
            await _api.DeleteShoppingListAsync(list.Id);
            await LoadDataAsync();
        }
        catch (Exception ex)
        {
            
                await AppShell.DisplaySnackbarAsync(ex.Message);
        }
    }

    [RelayCommand]
    private async Task NavigateToDetailAsync(ShoppingList list)
    {
        await Shell.Current.GoToAsync($"shopping-detail?listId={list.Id}");
    }
}
