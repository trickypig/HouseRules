using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HouseRules.PageModels;

public partial class MoneyPageModel : ObservableObject
{
    private readonly ApiClient _api;

    [ObservableProperty] private bool _isBusy;
    [ObservableProperty] private bool _isRefreshing;

    // Quick transaction
    [ObservableProperty] private bool _showQuickTransaction;
    [ObservableProperty] private Kid? _selectedKid;
    [ObservableProperty] private string _txType = "credit";
    [ObservableProperty] private string _txCategory = "";
    [ObservableProperty] private string _txAmountText = "";
    [ObservableProperty] private string _txDescription = "";
    [ObservableProperty] private DateTime _txDate = DateTime.Today;

    public ObservableCollection<Kid> Kids { get; } = [];
    public ObservableCollection<Transaction> RecentTransactions { get; } = [];

    public List<string> Types { get; } = ["credit", "debit"];
    public List<string> Categories { get; } = ["", "allowance", "chore", "gift", "spending", "adjustment"];

    public MoneyPageModel(ApiClient api)
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
            var kidsTask = _api.GetKidsAsync();
            var dashTask = _api.GetDashboardAsync();
            await Task.WhenAll(kidsTask, dashTask);

            Kids.Clear();
            foreach (var kid in kidsTask.Result.Kids) Kids.Add(kid);
            if (SelectedKid == null && Kids.Count > 0) SelectedKid = Kids[0];

            RecentTransactions.Clear();
            foreach (var t in dashTask.Result.RecentTransactions) RecentTransactions.Add(t);
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
    private void ToggleQuickTransaction() => ShowQuickTransaction = !ShowQuickTransaction;

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
            await _api.CreateTransactionAsync(SelectedKid.Id, type: TxType, amount: amount,
                category: TxCategory, description: TxDescription,
                transactionDate: TxDate.ToString("yyyy-MM-dd"));
            TxAmountText = "";
            TxDescription = "";
            ShowQuickTransaction = false;
            await LoadDataAsync();
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task NavigateToKidAsync(Kid kid)
    {
        await Shell.Current.GoToAsync($"kid-detail?kidId={kid.Id}");
    }
}
