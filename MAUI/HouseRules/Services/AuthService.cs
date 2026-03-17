using CommunityToolkit.Mvvm.ComponentModel;
using HouseRules.Models;

namespace HouseRules.Services;

public partial class AuthService : ObservableObject
{
    private const string TokenKey = "auth_token";

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsAuthenticated))]
    [NotifyPropertyChangedFor(nameof(IsParent))]
    [NotifyPropertyChangedFor(nameof(IsKid))]
    private User? _user;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsAuthenticated))]
    private string? _token;

    public bool IsAuthenticated => User is not null && Token is not null;
    public bool IsParent => User?.Role == "parent";
    public bool IsKid => User?.Role == "kid";

    public async Task<bool> LoadStoredTokenAsync()
    {
        try
        {
            var storedToken = await SecureStorage.GetAsync(TokenKey);
            if (storedToken is not null)
            {
                Token = storedToken;
                return true;
            }
        }
        catch
        {
            // SecureStorage can fail on some platforms
        }
        return false;
    }

    public void SetAuth(string token, User user)
    {
        Token = token;
        User = user;
        SecureStorage.SetAsync(TokenKey, token).ConfigureAwait(false);
    }

    public async Task LogoutAsync()
    {
        Token = null;
        User = null;
        try
        {
            SecureStorage.Remove(TokenKey);
        }
        catch
        {
            // Ignore SecureStorage errors
        }
        await Shell.Current.GoToAsync("//login");
    }
}
