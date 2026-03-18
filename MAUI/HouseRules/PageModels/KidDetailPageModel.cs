using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HouseRules.PageModels;

[QueryProperty(nameof(KidId), "kidId")]
public partial class KidDetailPageModel : ObservableObject
{
    private readonly ApiClient _api;
    private int _currentPage = 1;
    private bool _hasMore = true;

    [ObservableProperty] private int _kidId;
    [ObservableProperty] private Kid? _kid;
    [ObservableProperty] private bool _isBusy;
    [ObservableProperty] private bool _isRefreshing;
    [ObservableProperty] private bool _isLoadingMore;

    // Kid editing (consolidated: name/color/avatar + login)
    [ObservableProperty] private bool _isEditingKid;
    [ObservableProperty] private string _editKidName = "";
    [ObservableProperty] private string _editKidColor = "#512BD4";
    [ObservableProperty] private string _editKidAvatar = "";
    [ObservableProperty] private string _editKidLoginEmail = "";
    [ObservableProperty] private string _editKidLoginPassword = "";
    [ObservableProperty] private KidUser? _kidLogin;

    public bool HasKidLogin => KidLogin != null;

    // Add transaction form
    [ObservableProperty] private bool _showAddTransaction;
    [ObservableProperty] private string _txType = "credit";
    [ObservableProperty] private string _txCategory = "";
    [ObservableProperty] private string _txAmountText = "";
    [ObservableProperty] private string _txDescription = "";
    [ObservableProperty] private DateTime _txDate = DateTime.Today;

    // Add recurring form
    [ObservableProperty] private bool _showAddRecurring;
    [ObservableProperty] private string _recType = "credit";
    [ObservableProperty] private string _recCategory = "allowance";
    [ObservableProperty] private string _recAmountText = "";
    [ObservableProperty] private string _recDescription = "";
    [ObservableProperty] private string _recFrequency = "weekly";
    [ObservableProperty] private int _recDayOfWeek;
    [ObservableProperty] private int _recDayOfMonth = 1;
    [ObservableProperty] private DateTime _recStartDate = DateTime.Today;

    // Add goal form
    [ObservableProperty] private bool _showAddGoal;
    [ObservableProperty] private string _goalName = "";
    [ObservableProperty] private string _goalTargetText = "";
    [ObservableProperty] private DateTime? _goalWantByDate;

    public ObservableCollection<Transaction> Transactions { get; } = [];
    public ObservableCollection<Transaction> RecentTransactions { get; } = [];
    public ObservableCollection<Transaction> FutureTransactions { get; } = [];
    public ObservableCollection<RecurringTransaction> RecurringTransactions { get; } = [];
    public ObservableCollection<SavingsGoal> Goals { get; } = [];
    public ObservableCollection<GoalProjection> GoalProjections { get; } = [];
    public ObservableCollection<WeekSummary> WeeklySummary { get; } = [];
    public ObservableCollection<BalanceChartPoint> ChartData { get; } = [];

    public List<string> Types { get; } = ["credit", "debit"];
    public List<string> Categories { get; } = ["", "allowance", "chore", "gift", "spending", "adjustment"];
    public List<string> Frequencies { get; } = ["weekly", "biweekly", "monthly"];
    public List<string> DaysOfWeek { get; } = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    public KidDetailPageModel(ApiClient api)
    {
        _api = api;
    }

    partial void OnKidIdChanged(int value)
    {
        if (value > 0) LoadDataCommand.Execute(null);
    }

    partial void OnKidLoginChanged(KidUser? value)
    {
        OnPropertyChanged(nameof(HasKidLogin));
    }

    [RelayCommand]
    private async Task LoadDataAsync()
    {
        if (IsBusy || KidId <= 0) return;
        IsBusy = true;
        _currentPage = 1;
        _hasMore = true;
        try
        {
            var kidTask = _api.GetKidAsync(KidId);
            var today = DateTime.Today.ToString("yyyy-MM-dd");
            var tomorrow = DateTime.Today.AddDays(1).ToString("yyyy-MM-dd");
            var txTask = _api.GetTransactionsAsync(KidId, to: today, page: 1, perPage: 20);
            var futureTxTask = _api.GetTransactionsAsync(KidId, from: tomorrow, perPage: 100);
            var recurTask = _api.GetRecurringAsync(KidId);
            var goalsTask = _api.GetGoalsAsync(KidId);
            var weeklyTask = _api.GetWeeklySummaryAsync(KidId, 12);
            var projectionsTask = _api.GetGoalProjectionsAsync(KidId);

            await Task.WhenAll(kidTask, txTask, futureTxTask, recurTask, goalsTask, weeklyTask, projectionsTask);

            Kid = kidTask.Result.Kid;

            Transactions.Clear();
            RecentTransactions.Clear();
            FutureTransactions.Clear();
            foreach (var t in txTask.Result.Transactions)
            {
                Transactions.Add(t);
                RecentTransactions.Add(t);
            }
            foreach (var t in futureTxTask.Result.Transactions.OrderBy(t => t.TransactionDate))
            {
                Transactions.Add(t);
                FutureTransactions.Add(t);
            }
            _hasMore = txTask.Result.Pagination.Page < txTask.Result.Pagination.TotalPages;

            RecurringTransactions.Clear();
            foreach (var r in recurTask.Result.Recurring) RecurringTransactions.Add(r);

            Goals.Clear();
            foreach (var g in goalsTask.Result.Goals) Goals.Add(g);

            GoalProjections.Clear();
            foreach (var p in projectionsTask.Result.Projections) GoalProjections.Add(p);

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

            // Load kid login info
            try
            {
                var kidUsers = await _api.GetKidUsersAsync();
                KidLogin = kidUsers.KidUsers.FirstOrDefault(ku => ku.KidId == KidId);
            }
            catch { /* not critical */ }
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

    // Kid editing (consolidated: profile + login)
    [RelayCommand]
    private void StartEditKid()
    {
        if (Kid == null) return;
        EditKidName = Kid.Name;
        EditKidColor = Kid.Color;
        EditKidAvatar = Kid.Avatar;
        EditKidLoginEmail = KidLogin?.Email ?? "";
        EditKidLoginPassword = "";
        IsEditingKid = true;
    }

    [RelayCommand]
    private void CancelEditKid() => IsEditingKid = false;

    [RelayCommand]
    private async Task SaveKidAsync()
    {
        try
        {
            // Save kid profile
            await _api.UpdateKidAsync(KidId, name: EditKidName, color: EditKidColor, avatar: EditKidAvatar);

            // Handle login changes
            if (KidLogin != null)
            {
                // Update existing login if changed
                string? email = EditKidLoginEmail != KidLogin.Email ? EditKidLoginEmail : null;
                string? password = !string.IsNullOrWhiteSpace(EditKidLoginPassword) ? EditKidLoginPassword : null;
                if (email != null || password != null)
                {
                    var result = await _api.UpdateKidLoginAsync(KidLogin.Id, email: email, password: password);
                    KidLogin = result.KidUser;
                }
            }
            else if (!string.IsNullOrWhiteSpace(EditKidLoginEmail) && !string.IsNullOrWhiteSpace(EditKidLoginPassword))
            {
                // Create new login if both fields provided
                var result = await _api.CreateKidLoginAsync(KidId, EditKidLoginEmail, EditKidLoginPassword);
                KidLogin = result.KidUser;
            }

            IsEditingKid = false;
            await LoadDataAsync();
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task DeleteKidAsync()
    {
        var confirm = await Shell.Current.DisplayAlertAsync("Delete Kid", $"Delete {Kid?.Name}? This cannot be undone.", "Delete", "Cancel");
        if (!confirm) return;
        try
        {
            await _api.DeleteKidAsync(KidId);
            await Shell.Current.GoToAsync("..");
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    // Transactions
    [RelayCommand]
    private void ToggleAddTransaction() => ShowAddTransaction = !ShowAddTransaction;

    [RelayCommand]
    private async Task SubmitTransactionAsync()
    {
        if (!decimal.TryParse(TxAmountText, out var amount) || amount <= 0) return;
        try
        {
            await _api.CreateTransactionAsync(KidId, type: TxType, amount: amount,
                category: TxCategory, description: TxDescription,
                transactionDate: TxDate.ToString("yyyy-MM-dd"));
            ShowAddTransaction = false;
            TxAmountText = "";
            TxDescription = "";
            await LoadDataAsync();
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task LoadMoreTransactionsAsync()
    {
        if (IsLoadingMore || !_hasMore) return;
        IsLoadingMore = true;
        try
        {
            _currentPage++;
            var today = DateTime.Today.ToString("yyyy-MM-dd");
            var result = await _api.GetTransactionsAsync(KidId, to: today, page: _currentPage, perPage: 20);
            foreach (var t in result.Transactions)
            {
                Transactions.Add(t);
                RecentTransactions.Add(t);
            }
            _hasMore = result.Pagination.Page < result.Pagination.TotalPages;
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
        finally { IsLoadingMore = false; }
    }

    [RelayCommand]
    private async Task VerifyTransactionAsync(Transaction transaction)
    {
        try { await _api.VerifyTransactionAsync(transaction.Id); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task CancelTransactionAsync(Transaction transaction)
    {
        try { await _api.CancelTransactionAsync(transaction.Id); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task DeleteTransactionAsync(Transaction transaction)
    {
        var confirm = await Shell.Current.DisplayAlertAsync("Delete", "Delete this transaction?", "Delete", "Cancel");
        if (!confirm) return;
        try { await _api.DeleteTransactionAsync(transaction.Id); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task VerifyAllPendingAsync()
    {
        try { await _api.VerifyAllPendingAsync(KidId); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    // Recurring
    [RelayCommand]
    private void ToggleAddRecurring() => ShowAddRecurring = !ShowAddRecurring;

    [RelayCommand]
    private async Task SubmitRecurringAsync()
    {
        if (!decimal.TryParse(RecAmountText, out var amount) || amount <= 0) return;
        try
        {
            await _api.CreateRecurringAsync(KidId, type: RecType, amount: amount, frequency: RecFrequency,
                category: RecCategory, description: RecDescription,
                dayOfWeek: RecFrequency != "monthly" ? RecDayOfWeek : null,
                dayOfMonth: RecFrequency == "monthly" ? RecDayOfMonth : null,
                startDate: RecStartDate.ToString("yyyy-MM-dd"));
            ShowAddRecurring = false;
            RecAmountText = "";
            RecDescription = "";
            await LoadDataAsync();
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task ToggleRecurringActiveAsync(RecurringTransaction rec)
    {
        try
        {
            await _api.UpdateRecurringAsync(rec.Id, isActive: rec.IsActive == 1 ? false : true);
            await LoadDataAsync();
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task DeleteRecurringAsync(RecurringTransaction rec)
    {
        var confirm = await Shell.Current.DisplayAlertAsync("Delete", "Delete this recurring transaction?", "Delete", "Cancel");
        if (!confirm) return;
        try { await _api.DeleteRecurringAsync(rec.Id); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    // Goals
    [RelayCommand]
    private void ToggleAddGoal() => ShowAddGoal = !ShowAddGoal;

    [RelayCommand]
    private async Task SubmitGoalAsync()
    {
        if (string.IsNullOrWhiteSpace(GoalName)) return;
        decimal? target = decimal.TryParse(GoalTargetText, out var t) ? t : null;
        try
        {
            await _api.CreateGoalAsync(KidId, GoalName, targetAmount: target,
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
        var ids = Goals.Select(g => g.Id).ToList();
        var idx = ids.IndexOf(goal.Id);
        if (idx <= 0) return;
        (ids[idx], ids[idx - 1]) = (ids[idx - 1], ids[idx]);
        try { await _api.ReorderGoalsAsync(KidId, ids); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task MoveGoalDownAsync(SavingsGoal goal)
    {
        var ids = Goals.Select(g => g.Id).ToList();
        var idx = ids.IndexOf(goal.Id);
        if (idx < 0 || idx >= ids.Count - 1) return;
        (ids[idx], ids[idx + 1]) = (ids[idx + 1], ids[idx]);
        try { await _api.ReorderGoalsAsync(KidId, ids); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }
}
