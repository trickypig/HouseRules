using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HouseRules.PageModels;

public partial class ChoreBoardPageModel : ObservableObject
{
    private readonly ApiClient _api;
    private readonly AuthService _auth;

    [ObservableProperty] private bool _isBusy;
    [ObservableProperty] private bool _isRefreshing;

    // Form
    [ObservableProperty] private bool _showChoreForm;
    [ObservableProperty] private int? _editingChoreId;
    [ObservableProperty] private string _choreTitle = "";
    [ObservableProperty] private string _choreDescription = "";
    [ObservableProperty] private string _choreAmountText = "";
    [ObservableProperty] private string _choreFrequency = "one-time";
    [ObservableProperty] private int _choreDayOfWeek;
    [ObservableProperty] private int _choreDayOfMonth = 1;
    [ObservableProperty] private Kid? _choreAssignedKid;
    [ObservableProperty] private DateTime _choreStartDate = DateTime.Today;
    [ObservableProperty] private DateTime? _choreEndDate;

    public ObservableCollection<ChoreTemplate> Templates { get; } = [];
    public ObservableCollection<ChoreInstance> AwaitingVerification { get; } = [];
    public ObservableCollection<ChoreInstance> TodayInstances { get; } = [];
    public ObservableCollection<ChoreInstance> UpcomingInstances { get; } = [];

    // For kid assignment picker (includes "Unassigned" sentinel with Id=0)
    public ObservableCollection<Kid> Kids { get; } = [];
    private static readonly Kid _unassignedKid = new() { Id = 0, Name = "Unassigned" };

    public bool IsParent => _auth.IsParent;

    public List<string> FrequencyOptions { get; } = ["one-time", "daily", "weekly", "biweekly", "monthly"];
    public List<string> DaysOfWeek { get; } = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    public ChoreBoardPageModel(ApiClient api, AuthService auth)
    {
        _api = api;
        _auth = auth;
    }

    [RelayCommand]
    private async Task LoadDataAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            var data = await _api.GetChoreBoardAsync();
            Templates.Clear();
            foreach (var t in data.Templates) Templates.Add(t);

            // Categorize instances
            AwaitingVerification.Clear();
            TodayInstances.Clear();
            UpcomingInstances.Clear();
            var today = DateTime.Today.ToString("yyyy-MM-dd");
            var seenTemplates = new HashSet<int>();

            foreach (var i in data.Instances)
            {
                if (i.Status == "completed")
                    AwaitingVerification.Add(i);
                else if (string.Compare(i.DueDate, today, StringComparison.Ordinal) <= 0)
                    TodayInstances.Add(i);
                else if (i.ChoreTemplateId.HasValue && seenTemplates.Add(i.ChoreTemplateId.Value))
                    UpcomingInstances.Add(i);
            }

            // Load kids for assignment picker
            if (IsParent && Kids.Count == 0)
            {
                try
                {
                    var kidsResult = await _api.GetKidsAsync();
                    Kids.Clear();
                    Kids.Add(_unassignedKid);
                    foreach (var k in kidsResult.Kids) Kids.Add(k);
                }
                catch { /* not critical */ }
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
    private void ToggleChoreForm()
    {
        if (ShowChoreForm)
        {
            ShowChoreForm = false;
            EditingChoreId = null;
        }
        else
        {
            ResetForm();
            ShowChoreForm = true;
        }
    }

    [RelayCommand]
    private void EditChore(ChoreTemplate template)
    {
        EditingChoreId = template.Id;
        ChoreTitle = template.Title;
        ChoreDescription = template.Description;
        ChoreAmountText = template.Amount?.ToString("F2") ?? "";
        ChoreFrequency = template.Frequency ?? "one-time";
        ChoreDayOfWeek = template.DayOfWeek ?? 0;
        ChoreDayOfMonth = template.DayOfMonth ?? 1;
        ChoreAssignedKid = Kids.FirstOrDefault(k => k.Id == template.AssignedKidId) ?? _unassignedKid;
        if (DateTime.TryParse(template.StartDate, out var sd)) ChoreStartDate = sd;
        ShowChoreForm = true;
    }

    private void ResetForm()
    {
        EditingChoreId = null;
        ChoreTitle = "";
        ChoreDescription = "";
        ChoreAmountText = "";
        ChoreFrequency = "one-time";
        ChoreDayOfWeek = 0;
        ChoreDayOfMonth = 1;
        ChoreAssignedKid = _unassignedKid;
        ChoreStartDate = DateTime.Today;
        ChoreEndDate = null;
    }

    [RelayCommand]
    private async Task SubmitChoreAsync()
    {
        if (string.IsNullOrWhiteSpace(ChoreTitle)) return;
        decimal? amount = decimal.TryParse(ChoreAmountText, out var a) ? a : null;
        string? freq = ChoreFrequency == "one-time" ? null : ChoreFrequency;
        int? assignedKidId = ChoreAssignedKid?.Id is > 0 ? ChoreAssignedKid.Id : null;

        try
        {
            if (EditingChoreId.HasValue)
            {
                await _api.UpdateChoreAsync(EditingChoreId.Value,
                    title: ChoreTitle, description: ChoreDescription, amount: amount,
                    frequency: freq,
                    dayOfWeek: freq is "weekly" or "biweekly" ? ChoreDayOfWeek : null,
                    dayOfMonth: freq == "monthly" ? ChoreDayOfMonth : null,
                    assignedKidId: assignedKidId,
                    startDate: ChoreStartDate.ToString("yyyy-MM-dd"),
                    endDate: ChoreEndDate?.ToString("yyyy-MM-dd"));
            }
            else
            {
                await _api.CreateChoreAsync(ChoreTitle, description: ChoreDescription, amount: amount,
                    frequency: freq,
                    dayOfWeek: freq is "weekly" or "biweekly" ? ChoreDayOfWeek : null,
                    dayOfMonth: freq == "monthly" ? ChoreDayOfMonth : null,
                    assignedKidId: assignedKidId,
                    startDate: ChoreStartDate.ToString("yyyy-MM-dd"),
                    endDate: ChoreEndDate?.ToString("yyyy-MM-dd"));
            }
            ShowChoreForm = false;
            ResetForm();
            await LoadDataAsync();
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task DeleteChoreAsync(ChoreTemplate template)
    {
        var confirm = await Shell.Current.DisplayAlertAsync("Delete", $"Delete chore '{template.Title}'?", "Delete", "Cancel");
        if (!confirm) return;
        try { await _api.DeleteChoreAsync(template.Id); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task VerifyChoreAsync(ChoreInstance instance)
    {
        try { await _api.VerifyChoreAsync(instance.Id); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task RejectChoreAsync(ChoreInstance instance)
    {
        try { await _api.RejectChoreAsync(instance.Id); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }
}
