using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace HouseRules.PageModels;

[QueryProperty(nameof(KidId), "kidId")]
[QueryProperty(nameof(TransactionId), "transactionId")]
public partial class TransactionFormPageModel : ObservableObject
{
    private readonly ApiClient _api;

    [ObservableProperty] private int _kidId;
    [ObservableProperty] private int _transactionId;
    [ObservableProperty] private string _type = "credit";
    [ObservableProperty] private string _category = string.Empty;
    [ObservableProperty] private string _amountText = string.Empty;
    [ObservableProperty] private string _description = string.Empty;
    [ObservableProperty] private DateTime _transactionDate = DateTime.Today;
    [ObservableProperty] private string? _errorMessage;
    [ObservableProperty] private bool _isBusy;
    [ObservableProperty] private bool _isEditing;

    public List<string> Types { get; } = ["credit", "debit"];

    public TransactionFormPageModel(ApiClient api)
    {
        _api = api;
    }

    partial void OnTransactionIdChanged(int value)
    {
        if (value > 0)
        {
            IsEditing = true;
            // Load transaction data for editing would go here
        }
    }

    [RelayCommand]
    private async Task SaveAsync()
    {
        if (!decimal.TryParse(AmountText, out var amount) || amount <= 0)
        {
            ErrorMessage = "Please enter a valid amount";
            return;
        }

        IsBusy = true;
        ErrorMessage = null;
        try
        {
            var dateStr = TransactionDate.ToString("yyyy-MM-dd");
            if (IsEditing)
            {
                await _api.UpdateTransactionAsync(TransactionId,
                    type: Type, category: Category, amount: amount,
                    description: Description, transactionDate: dateStr);
            }
            else
            {
                await _api.CreateTransactionAsync(KidId,
                    type: Type, amount: amount, category: Category,
                    description: Description, transactionDate: dateStr);
            }
            await Shell.Current.GoToAsync("..");
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
    private async Task CancelAsync()
    {
        await Shell.Current.GoToAsync("..");
    }
}
