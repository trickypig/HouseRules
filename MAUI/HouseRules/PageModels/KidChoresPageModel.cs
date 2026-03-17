using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HouseRules.PageModels;

public partial class KidChoresPageModel : ObservableObject
{
    private readonly ApiClient _api;

    [ObservableProperty] private bool _isBusy;
    [ObservableProperty] private bool _isRefreshing;

    public ObservableCollection<ChoreInstance> OverdueChores { get; } = [];
    public ObservableCollection<ChoreInstance> TodoChores { get; } = [];
    public ObservableCollection<ChoreInstance> AvailableChores { get; } = [];
    public ObservableCollection<ChoreInstance> AwaitingVerificationChores { get; } = [];

    public KidChoresPageModel(ApiClient api)
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
            var data = await _api.GetMyChoresAsync();
            var today = DateTime.Today.ToString("yyyy-MM-dd");

            OverdueChores.Clear();
            TodoChores.Clear();
            AvailableChores.Clear();
            AwaitingVerificationChores.Clear();

            foreach (var c in data.MyChores)
            {
                if (c.Status == "completed")
                    AwaitingVerificationChores.Add(c);
                else if (string.Compare(c.DueDate, today, StringComparison.Ordinal) < 0)
                    OverdueChores.Add(c);
                else
                    TodoChores.Add(c);
            }

            foreach (var c in data.OpenChores)
                AvailableChores.Add(c);
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
    private async Task ClaimChoreAsync(ChoreInstance chore)
    {
        try { await _api.ClaimChoreAsync(chore.Id); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task CompleteChoreAsync(ChoreInstance chore)
    {
        try { await _api.CompleteChoreAsync(chore.Id); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task ClaimAndCompleteChoreAsync(ChoreInstance chore)
    {
        try
        {
            await _api.ClaimChoreAsync(chore.Id);
            await _api.CompleteChoreAsync(chore.Id);
            await LoadDataAsync();
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }
}
