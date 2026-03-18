using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HouseRules.PageModels;

public partial class KidMoneyPageModel : ObservableObject
{
    private readonly ApiClient _api;
    private int _currentPage = 1;
    private bool _hasMore = true;

    [ObservableProperty] private bool _isBusy;
    [ObservableProperty] private bool _isRefreshing;
    [ObservableProperty] private bool _isLoadingMore;
    [ObservableProperty] private Kid? _kid;

    // Request form
    [ObservableProperty] private string? _activeRequestType;
    [ObservableProperty] private string _requestAmountText = "";
    [ObservableProperty] private string _requestDescription = "";
    [ObservableProperty] private string? _successMessage;

    // Add goal form
    [ObservableProperty] private bool _showAddGoal;
    [ObservableProperty] private string _goalName = "";
    [ObservableProperty] private string _goalTargetText = "";
    [ObservableProperty] private DateTime? _goalWantByDate;

    public ObservableCollection<Transaction> RecentTransactions { get; } = [];
    public ObservableCollection<Transaction> FutureTransactions { get; } = [];
    public ObservableCollection<RecurringTransaction> Recurring { get; } = [];
    public ObservableCollection<SavingsGoal> Goals { get; } = [];
    public ObservableCollection<WeekSummary> WeeklySummary { get; } = [];
    public ObservableCollection<BalanceChartPoint> ChartData { get; } = [];

    public KidMoneyPageModel(ApiClient api)
    {
        _api = api;
    }

    [RelayCommand]
    private async Task LoadDataAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        _currentPage = 1;
        _hasMore = true;
        try
        {
            var dashTask = _api.GetMyDashboardAsync();
            var today = DateTime.Today.ToString("yyyy-MM-dd");
            var tomorrow = DateTime.Today.AddDays(1).ToString("yyyy-MM-dd");
            var txTask = _api.GetMyTransactionsAsync(to: today, page: 1, perPage: 20);
            var futureTxTask = _api.GetMyTransactionsAsync(from: tomorrow, perPage: 100);
            var weeklyTask = _api.GetMyWeeklySummaryAsync(12);
            await Task.WhenAll(dashTask, txTask, futureTxTask, weeklyTask);

            var data = dashTask.Result;
            Kid = data.Kid;

            Recurring.Clear();
            foreach (var r in data.Recurring) Recurring.Add(r);

            Goals.Clear();
            foreach (var g in data.Goals) Goals.Add(g);

            RecentTransactions.Clear();
            FutureTransactions.Clear();
            foreach (var t in txTask.Result.Transactions)
                RecentTransactions.Add(t);
            foreach (var t in futureTxTask.Result.Transactions.OrderBy(t => t.TransactionDate))
                FutureTransactions.Add(t);
            _hasMore = txTask.Result.Pagination.Page < txTask.Result.Pagination.TotalPages;

            WeeklySummary.Clear();
            foreach (var w in weeklyTask.Result.Weeks) WeeklySummary.Add(w);

            ChartData.Clear();
            var weeks = weeklyTask.Result.Weeks;
            for (int i = 0; i < weeks.Count; i++)
            {
                var w = weeks[i];
                var prevBalance = i > 0 ? weeks[i - 1].Balance : w.Balance - w.Credits + w.Debits;
                ChartData.Add(BalanceChartPoint.Historical(w.WeekEndShort, (double)w.Balance,
                    (double)prevBalance, (double)(prevBalance + w.Credits),
                    (double)(prevBalance + w.Credits), (double)w.Balance));
            }

            var lastBalance = weeks.Count > 0 ? weeks[^1].Balance : Kid?.Balance ?? 0;
            foreach (var fp in BalanceChartPoint.BuildFuturePoints(
                         futureTxTask.Result.Transactions, lastBalance))
                ChartData.Add(fp);
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
    private async Task LoadMoreAsync()
    {
        if (IsLoadingMore || !_hasMore) return;
        IsLoadingMore = true;
        try
        {
            _currentPage++;
            var today = DateTime.Today.ToString("yyyy-MM-dd");
            var data = await _api.GetMyTransactionsAsync(to: today, page: _currentPage, perPage: 20);
            foreach (var t in data.Transactions)
                RecentTransactions.Add(t);
            _hasMore = data.Pagination.Page < data.Pagination.TotalPages;
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
        finally { IsLoadingMore = false; }
    }

    [RelayCommand]
    private void ToggleRequestType(string type)
    {
        ActiveRequestType = ActiveRequestType == type ? null : type;
        RequestAmountText = "";
        RequestDescription = "";
        SuccessMessage = null;
    }

    [RelayCommand]
    private async Task SubmitRequestAsync()
    {
        if (!decimal.TryParse(RequestAmountText, out var amount) || amount <= 0) return;
        if (string.IsNullOrWhiteSpace(RequestDescription)) return;
        try
        {
            string type = ActiveRequestType == "spending" ? "debit" : "credit";
            string category = ActiveRequestType ?? "spending";
            await _api.RequestMoneyAsync(amount, RequestDescription, type: type, category: category);
            RequestAmountText = "";
            RequestDescription = "";
            SuccessMessage = "Request sent to your parent!";
            await LoadDataAsync();
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    // Goals
    [RelayCommand]
    private void ToggleAddGoal() => ShowAddGoal = !ShowAddGoal;

    [RelayCommand]
    private async Task SubmitGoalAsync()
    {
        if (string.IsNullOrWhiteSpace(GoalName) || Kid == null) return;
        decimal? target = decimal.TryParse(GoalTargetText, out var t) ? t : null;
        try
        {
            await _api.CreateGoalAsync(Kid.Id, GoalName, targetAmount: target,
                wantByDate: GoalWantByDate?.ToString("yyyy-MM-dd"));
            ShowAddGoal = false;
            GoalName = "";
            GoalTargetText = "";
            GoalWantByDate = null;
            await LoadDataAsync();
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task DeleteGoalAsync(SavingsGoal goal)
    {
        var confirm = await Shell.Current.DisplayAlertAsync("Delete", $"Delete goal '{goal.Name}'?", "Delete", "Cancel");
        if (!confirm) return;
        try { await _api.DeleteGoalAsync(goal.Id); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task MoveGoalUpAsync(SavingsGoal goal)
    {
        if (Kid == null) return;
        var ids = Goals.Select(g => g.Id).ToList();
        var idx = ids.IndexOf(goal.Id);
        if (idx <= 0) return;
        (ids[idx], ids[idx - 1]) = (ids[idx - 1], ids[idx]);
        try { await _api.ReorderGoalsAsync(Kid.Id, ids); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task MoveGoalDownAsync(SavingsGoal goal)
    {
        if (Kid == null) return;
        var ids = Goals.Select(g => g.Id).ToList();
        var idx = ids.IndexOf(goal.Id);
        if (idx < 0 || idx >= ids.Count - 1) return;
        (ids[idx], ids[idx + 1]) = (ids[idx + 1], ids[idx]);
        try { await _api.ReorderGoalsAsync(Kid.Id, ids); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }
}
