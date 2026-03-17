using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HouseRules.PageModels;

public partial class LoginPageModel : ObservableObject
{
    private readonly AuthService _auth;
    private readonly ApiClient _api;

    [ObservableProperty] private string _email = string.Empty;
    [ObservableProperty] private string _password = string.Empty;
    [ObservableProperty] private string? _errorMessage;
    [ObservableProperty] private bool _isBusy;

    public LoginPageModel(AuthService auth, ApiClient api)
    {
        _auth = auth;
        _api = api;
    }

    [RelayCommand]
    private async Task LoginAsync()
    {
        if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "Please enter email and password";
            return;
        }

        IsBusy = true;
        ErrorMessage = null;
        try
        {
            var result = await _api.LoginAsync(Email, Password);
            _auth.SetAuth(result.Token, result.User);
            await NavigateToDashboard();
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
    private async Task GoToRegisterAsync()
    {
        await Shell.Current.GoToAsync("register");
    }

    private async Task NavigateToDashboard()
    {
        if (_auth.IsParent)
            await Shell.Current.GoToAsync("//parent-dashboard");
        else
            await Shell.Current.GoToAsync("//kid-dashboard");
    }
}
