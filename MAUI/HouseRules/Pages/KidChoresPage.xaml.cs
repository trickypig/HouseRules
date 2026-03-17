namespace HouseRules.Pages;

public partial class KidChoresPage : ContentPage
{
    private readonly KidChoresPageModel _viewModel;

    public KidChoresPage(KidChoresPageModel viewModel)
    {
        InitializeComponent();
        BindingContext = _viewModel = viewModel;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        _viewModel.LoadDataCommand.Execute(null);
    }
}
