using System.Collections;
using System.Collections.Specialized;
using Syncfusion.Maui.Toolkit.Charts;

namespace HouseRules.Controls;

public partial class BalanceChartView : ContentView
{
    public static readonly BindableProperty ChartDataProperty =
        BindableProperty.Create(nameof(ChartData), typeof(IList), typeof(BalanceChartView),
            propertyChanged: OnChartDataChanged);

    public static readonly BindableProperty GoalsProperty =
        BindableProperty.Create(nameof(Goals), typeof(IList), typeof(BalanceChartView),
            propertyChanged: OnGoalsChanged);

    public IList? ChartData
    {
        get => (IList?)GetValue(ChartDataProperty);
        set => SetValue(ChartDataProperty, value);
    }

    public IList? Goals
    {
        get => (IList?)GetValue(GoalsProperty);
        set => SetValue(GoalsProperty, value);
    }

    public BalanceChartView()
    {
        InitializeComponent();
        BalanceChart.TrackballCreated += OnTrackballCreated;
    }

    private static void OnChartDataChanged(BindableObject bindable, object oldValue, object newValue)
    {
        if (bindable is not BalanceChartView view || newValue is not IList data) return;
        view.CreditSeries.ItemsSource = data;
        view.DebitSeries.ItemsSource = data;
        view.BalanceLine.ItemsSource = data;
    }

    private static void OnGoalsChanged(BindableObject bindable, object oldValue, object newValue)
    {
        if (bindable is not BalanceChartView view) return;

        if (oldValue is INotifyCollectionChanged oldCollection)
            oldCollection.CollectionChanged -= view.OnGoalsCollectionChanged;

        if (newValue is INotifyCollectionChanged newCollection)
            newCollection.CollectionChanged += view.OnGoalsCollectionChanged;

        view.UpdateGoalAnnotations();
    }

    private void OnGoalsCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        UpdateGoalAnnotations();
    }

    private void OnTrackballCreated(object? sender, TrackballEventArgs e)
    {
        BalanceChartPoint? dataPoint = null;

        foreach (var info in e.TrackballPointsInfo)
        {
            if (info.DataItem is BalanceChartPoint pt)
                dataPoint = pt;
            info.Label = string.Empty;
        }

        if (dataPoint == null || e.TrackballPointsInfo.Count == 0) return;

        var balanceInfo = e.TrackballPointsInfo[^1];
        var credits = dataPoint.CreditHigh - dataPoint.CreditLow;
        var debits = dataPoint.DebitHigh - dataPoint.DebitLow;
        var prev = dataPoint.Balance + debits - credits;

        balanceInfo.Label = $"Prev Week: {prev:C2}\nEarned: {credits:C2}\nSpent: {debits:C2}\nBalance: {dataPoint.Balance:C2}";
    }

    private void UpdateGoalAnnotations()
    {
        BalanceChart.Annotations.Clear();

        if (Goals == null) return;

        var colors = new[] { "#00F0FF", "#FFFF00", "#B026FF", "#FF6B00", "#39FF14" };
        int colorIdx = 0;

        foreach (var item in Goals)
        {
            if (item is not SavingsGoal goal || goal.TargetAmount is not > 0) continue;

            var color = Color.FromArgb(colors[colorIdx % colors.Length]);
            colorIdx++;

            BalanceChart.Annotations.Add(new HorizontalLineAnnotation
            {
                Y1 = (double)goal.TargetAmount.Value,
                Stroke = color,
                StrokeWidth = 1.5,
                StrokeDashArray = [5, 3],
                Text = $"{goal.Name}: {goal.TargetAmount:C0}",
                LabelStyle = new ChartAnnotationLabelStyle
                {
                    FontSize = 10,
                    TextColor = color,
                    HorizontalTextAlignment = ChartLabelAlignment.End,
                    VerticalTextAlignment = ChartLabelAlignment.Start
                }
            });
        }
    }
}
