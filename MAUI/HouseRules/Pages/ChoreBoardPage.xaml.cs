namespace HouseRules.Pages;

public partial class ChoreBoardPage : ContentPage
{
    private readonly ChoreBoardPageModel _viewModel;

    public ChoreBoardPage(ChoreBoardPageModel viewModel)
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
