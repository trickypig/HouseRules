using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HouseRules.PageModels;

public partial class KidDashboardPageModel : ObservableObject
{
    private readonly ApiClient _api;

    [ObservableProperty] private Kid? _kid;
    [ObservableProperty] private bool _isBusy;
    [ObservableProperty] private bool _isRefreshing;

    // Request form
    [ObservableProperty] private string? _activeRequestType; // "spending", "gift", "chore"
    [ObservableProperty] private string _requestAmountText = "";
    [ObservableProperty] private string _requestDescription = "";
    [ObservableProperty] private string? _successMessage;

    // Add goal form
    [ObservableProperty] private bool _showAddGoal;
    [ObservableProperty] private string _goalName = "";
    [ObservableProperty] private string _goalTargetText = "";
    [ObservableProperty] private DateTime? _goalWantByDate;

    public ObservableCollection<SavingsGoal> Goals { get; } = [];

    // Chores (dashboard only shows overdue)
    public ObservableCollection<ChoreInstance> OverdueChores { get; } = [];

    public KidDashboardPageModel(ApiClient api)
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
            var dashTask = _api.GetMyDashboardAsync();
            var choresTask = _api.GetMyChoresAsync();
            await Task.WhenAll(dashTask, choresTask);

            var data = dashTask.Result;
            Kid = data.Kid;

            Goals.Clear();
            foreach (var g in data.Goals) Goals.Add(g);

            // Chores (dashboard only shows overdue)
            var chores = choresTask.Result;
            OverdueChores.Clear();
            foreach (var c in chores.MyChores)
            {
                if (c.Status == "missed") OverdueChores.Add(c);
            }
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

    // Request types
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
