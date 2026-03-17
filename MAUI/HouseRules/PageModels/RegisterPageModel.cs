using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HouseRules.PageModels;

public partial class RegisterPageModel : ObservableObject
{
    private readonly AuthService _auth;
    private readonly ApiClient _api;

    [ObservableProperty] private string _email = string.Empty;
    [ObservableProperty] private string _password = string.Empty;
    [ObservableProperty] private string _displayName = string.Empty;
    [ObservableProperty] private string? _errorMessage;
    [ObservableProperty] private bool _isBusy;

    public RegisterPageModel(AuthService auth, ApiClient api)
    {
        _auth = auth;
        _api = api;
    }

    [RelayCommand]
    private async Task RegisterAsync()
    {
        if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password) || string.IsNullOrWhiteSpace(DisplayName))
        {
            ErrorMessage = "Please fill in all fields";
            return;
        }

        IsBusy = true;
        ErrorMessage = null;
        try
        {
            var result = await _api.RegisterAsync(Email, Password, DisplayName);
            _auth.SetAuth(result.Token, result.User);
            if (_auth.IsParent)
                await Shell.Current.GoToAsync("//parent-dashboard");
            else
                await Shell.Current.GoToAsync("//kid-dashboard");
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task GoBackAsync()
    {
        await Shell.Current.GoToAsync("..");
    }
}
