using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HouseRules.PageModels;

public partial class SettingsPageModel : ObservableObject
{
    private readonly AuthService _auth;
    private readonly ApiClient _api;

    [ObservableProperty] private bool _isBusy;
    [ObservableProperty] private string _displayName = string.Empty;
    [ObservableProperty] private string _familyDisplayName = string.Empty;
    [ObservableProperty] private Household? _household;
    [ObservableProperty] private string? _inviteCode;

    // Household name editing
    [ObservableProperty] private string _householdName = string.Empty;

    // Add kid form
    [ObservableProperty] private bool _showAddKid;
    [ObservableProperty] private string _newKidName = string.Empty;
    [ObservableProperty] private string _newKidColor = "#4A90D9";
    [ObservableProperty] private string _newKidAvatar = string.Empty;

    // Join household form
    [ObservableProperty] private bool _showJoinHousehold;
    [ObservableProperty] private string _joinInviteCode = string.Empty;

    public ObservableCollection<HouseholdMember> Members { get; } = [];
    public ObservableCollection<Kid> Kids { get; } = [];
    public ObservableCollection<KidUser> KidUsers { get; } = [];

    public bool IsParent => _auth.IsParent;

    public SettingsPageModel(AuthService auth, ApiClient api)
    {
        _auth = auth;
        _api = api;
    }

    [RelayCommand]
    private async Task LoadDataAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            DisplayName = _auth.User?.DisplayName ?? string.Empty;
            FamilyDisplayName = _auth.User?.FamilyDisplayName ?? string.Empty;

            if (_auth.IsParent)
            {
                var householdTask = _api.GetHouseholdAsync();
                var kidUsersTask = _api.GetKidUsersAsync();
                var kidsTask = _api.GetKidsAsync();
                await Task.WhenAll(householdTask, kidUsersTask, kidsTask);

                Household = householdTask.Result.Household;
                InviteCode = householdTask.Result.Household.InviteCode;
                HouseholdName = householdTask.Result.Household.Name;

                Members.Clear();
                foreach (var m in householdTask.Result.Members) Members.Add(m);

                KidUsers.Clear();
                foreach (var ku in kidUsersTask.Result.KidUsers) KidUsers.Add(ku);

                Kids.Clear();
                foreach (var k in kidsTask.Result.Kids) Kids.Add(k);
            }
        }
        catch (UnauthorizedAccessException) { }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
        finally { IsBusy = false; }
    }

    [RelayCommand]
    private async Task SaveProfileAsync()
    {
        try
        {
            var result = await _api.UpdateProfileAsync(DisplayName, FamilyDisplayName);
            _auth.User = result.User;
            await AppShell.DisplayToastAsync("Profile updated");
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task SaveHouseholdNameAsync()
    {
        if (string.IsNullOrWhiteSpace(HouseholdName)) return;
        try
        {
            var result = await _api.UpdateHouseholdAsync(HouseholdName);
            Household = result.Household;
            await AppShell.DisplayToastAsync("Household name updated");
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task RegenerateInviteCodeAsync()
    {
        try
        {
            var result = await _api.RegenerateInviteCodeAsync();
            InviteCode = result.InviteCode;
            await AppShell.DisplayToastAsync("Invite code regenerated");
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    // Join household
    [RelayCommand]
    private void ToggleJoinHousehold() => ShowJoinHousehold = !ShowJoinHousehold;

    [RelayCommand]
    private async Task JoinHouseholdAsync()
    {
        if (string.IsNullOrWhiteSpace(JoinInviteCode)) return;
        try
        {
            var result = await _api.JoinHouseholdAsync(JoinInviteCode.Trim());
            // Update token since household changed
            _auth.SetAuth(result.Token, _auth.User!);
            JoinInviteCode = string.Empty;
            ShowJoinHousehold = false;
            await AppShell.DisplayToastAsync("Joined household!");
            await LoadDataAsync();
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    // Kid management
    [RelayCommand]
    private void ToggleAddKid()
    {
        ShowAddKid = !ShowAddKid;
        if (ShowAddKid)
        {
            NewKidName = string.Empty;
            NewKidColor = "#4A90D9";
            NewKidAvatar = string.Empty;
        }
    }

    [RelayCommand]
    private async Task AddKidAsync()
    {
        if (string.IsNullOrWhiteSpace(NewKidName)) return;
        try
        {
            await _api.CreateKidAsync(NewKidName.Trim(),
                color: string.IsNullOrWhiteSpace(NewKidColor) ? null : NewKidColor,
                avatar: string.IsNullOrWhiteSpace(NewKidAvatar) ? null : NewKidAvatar.Trim());
            ShowAddKid = false;
            NewKidName = string.Empty;
            NewKidColor = "#4A90D9";
            NewKidAvatar = string.Empty;
            await LoadDataAsync();
        }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task DeleteKidAsync(Kid kid)
    {
        var confirm = await Shell.Current.DisplayAlertAsync("Delete Kid",
            $"Delete {kid.Name}? This will remove all their transactions, goals, and chore history.",
            "Delete", "Cancel");
        if (!confirm) return;
        try { await _api.DeleteKidAsync(kid.Id); await LoadDataAsync(); }
        catch (Exception ex) { await AppShell.DisplaySnackbarAsync(ex.Message); }
    }

    [RelayCommand]
    private async Task LogoutAsync()
    {
        await _auth.LogoutAsync();
    }
}
