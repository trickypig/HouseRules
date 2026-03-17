namespace HouseRules.Pages;

public partial class TransactionFormPage : ContentPage
{
    public TransactionFormPage(TransactionFormPageModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
