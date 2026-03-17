using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HouseRules.PageModels;

public partial class DashboardPageModel : ObservableObject
{
    private readonly ApiClient _api;

    [ObservableProperty] private bool _isBusy;
    [ObservableProperty] private bool _isRefreshing;

    // Quick transaction form
    [ObservableProperty] private bool _showQuickTransaction;
    [ObservableProperty] private Kid? _selectedKid;
    [ObservableProperty] private string _txType = "credit";
    [ObservableProperty] private string _txCategory = "";
    [ObservableProperty] private string _txAmountText = "";
    [ObservableProperty] private string _txDescription = "";
    [ObservableProperty] private DateTime _txDate = DateTime.Today;

    public ObservableCollection<Kid> Kids { get; } = [];
    public ObservableCollection<Transaction> PendingTransactions { get; } = [];
    public ObservableCollection<ChoreInstance> OverdueChores { get; } = [];
    public ObservableCollection<ChoreInstance> CompletedChores { get; } = [];
    public ObservableCollection<ShoppingList> ShoppingLists { get; } = [];

    public List<string> Types { get; } = ["credit", "debit"];
    public List<string> Categories { get; } = ["", "allowance", "chore", "gift", "spending", "adjustment"];

    public DashboardPageModel(ApiClient api)
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
            var data = await _api.GetDashboardAsync();

            Kids.Clear();
            foreach (var kid in data.Kids) Kids.Add(kid);
            if (SelectedKid == null && Kids.Count > 0) SelectedKid = Kids[0];

            PendingTransactions.Clear();
            foreach (var t in data.PendingTransactions) PendingTransactions.Add(t);

            OverdueChores.Clear();
            foreach (var c in data.OverdueChores) OverdueChores.Add(c);

            CompletedChores.Clear();
            foreach (var c in data.CompletedChores) CompletedChores.Add(c);

            ShoppingLists.Clear();
            foreach (var s in data.ShoppingLists) ShoppingLists.Add(s);
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
    private void ToggleQuickTransaction()
    {
        ShowQuickTransaction = !ShowQuickTransaction;
    }

    [RelayCommand]
    private async Task SubmitQuickTransactionAsync()
    {
        if (SelectedKid == null || !decimal.TryParse(TxAmountText, out var amount) || amount <= 0)
        {
            await AppShell.DisplaySnackbarAsync("Select a kid and enter a valid amount");
            return;
        }

        try
        {
            await _api.CreateTransactionAsync(SelectedKid.Id,
                type: TxType, amount: amount, category: TxCategory,
                description: TxDescription, transactionDate: TxDate.ToString("yyyy-MM-dd"));
            TxAmountText = "";
            TxDescription = "";
            TxCategory = "";
            TxDate = DateTime.Today;
            ShowQuickTransaction = false;
            await LoadDataAsync();
        }
        catch (Exception ex)
        {
            await AppShell.DisplaySnackbarAsync(ex.Message);
        }
    }

    [RelayCommand]
    private async Task VerifyTransactionAsync(Transaction transaction)
    {
        try
        {
            await _api.VerifyTransactionAsync(transaction.Id);
            await LoadDataAsync();
        }
        catch (Exception ex)
        {
            await AppShell.DisplaySnackbarAsync(ex.Message);
        }
    }

    [RelayCommand]
    private async Task CancelTransactionAsync(Transaction transaction)
    {
        try
        {
            await _api.CancelTransactionAsync(transaction.Id);
            await LoadDataAsync();
        }
        catch (Exception ex)
        {
            await AppShell.DisplaySnackbarAsync(ex.Message);
        }
    }

    [RelayCommand]
    private async Task VerifyChoreAsync(ChoreInstance chore)
    {
        try
        {
            await _api.VerifyChoreAsync(chore.Id);
            await LoadDataAsync();
        }
        catch (Exception ex)
        {
            await AppShell.DisplaySnackbarAsync(ex.Message);
        }
    }

    [RelayCommand]
    private async Task RejectChoreAsync(ChoreInstance chore)
    {
        try
        {
            await _api.RejectChoreAsync(chore.Id);
            await LoadDataAsync();
        }
        catch (Exception ex)
        {
            await AppShell.DisplaySnackbarAsync(ex.Message);
        }
    }

    [RelayCommand]
    private async Task NavigateToKidAsync(Kid kid)
    {
        await Shell.Current.GoToAsync($"kid-detail?kidId={kid.Id}");
    }

    [RelayCommand]
    private async Task NavigateToShoppingListAsync(ShoppingList list)
    {
        await Shell.Current.GoToAsync($"shopping-detail?listId={list.Id}");
    }
}
