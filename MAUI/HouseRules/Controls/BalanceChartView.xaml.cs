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
        if (bindable is not BalanceChartView view) return;

        if (oldValue is INotifyCollectionChanged oldCollection)
            oldCollection.CollectionChanged -= view.OnChartDataCollectionChanged;

        if (newValue is INotifyCollectionChanged newCollection)
            newCollection.CollectionChanged += view.OnChartDataCollectionChanged;

        if (newValue is IList data)
            view.UpdateSeriesData(data);
    }

    private void OnChartDataCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (sender is IList data)
            UpdateSeriesData(data);
    }

    private void UpdateSeriesData(IList data)
    {
        // Set the bridge: last historical point also gets FutureBalance
        // so the dashed future line connects seamlessly from the solid line.
        BalanceChartPoint? lastHistorical = null;
        bool hasFuture = false;
        foreach (var item in data)
        {
            if (item is not BalanceChartPoint pt) continue;
            if (!pt.IsFuture)
                lastHistorical = pt;
            else
                hasFuture = true;
        }
        if (lastHistorical != null && hasFuture)
            lastHistorical.FutureBalance = lastHistorical.Balance;

        // All 6 series share the same ItemsSource with consistent x-axis labels.
        // Historical bars/line use CreditHigh/CreditLow/HistBalance (collapsed for future points).
        // Future bars/line use FutureCreditHigh/FutureCreditLow/FutureBalance (collapsed for historical).
        // Need a new list reference each time so the chart re-reads values.
        var source = new List<BalanceChartPoint>();
        foreach (var item in data)
            if (item is BalanceChartPoint pt) source.Add(pt);

        CreditSeries.ItemsSource = source;
        DebitSeries.ItemsSource = source;
        BalanceLine.ItemsSource = source;
        FutureCreditSeries.ItemsSource = source;
        FutureDebitSeries.ItemsSource = source;
        FutureBalanceLine.ItemsSource = source;
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
        if (e.TrackballPointsInfo.Count == 0) return;

        // Get the data point from the first info entry
        BalanceChartPoint? dataPoint = null;
        foreach (var info in e.TrackballPointsInfo)
        {
            if (info.DataItem is BalanceChartPoint pt)
            {
                dataPoint = pt;
                break;
            }
        }

        // Clear all labels — we'll set just one
        foreach (var info in e.TrackballPointsInfo)
            info.Label = string.Empty;

        if (dataPoint == null) return;

        // Use the correct bar values depending on historical vs future
        double credits, debits;
        if (dataPoint.IsFuture)
        {
            credits = dataPoint.FutureCreditHigh - dataPoint.FutureCreditLow;
            debits = dataPoint.FutureDebitHigh - dataPoint.FutureDebitLow;
        }
        else
        {
            credits = dataPoint.CreditHigh - dataPoint.CreditLow;
            debits = dataPoint.DebitHigh - dataPoint.DebitLow;
        }

        var prev = dataPoint.Balance + debits - credits;
        var suffix = dataPoint.IsFuture ? " (projected)" : "";

        // Show the label on the first info entry only
        e.TrackballPointsInfo[0].Label =
            $"Prev Week: {prev:C2}\nEarned: {credits:C2}\nSpent: {debits:C2}\nBalance: {dataPoint.Balance:C2}{suffix}";
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
