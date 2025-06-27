# ViVo: In Vivo Tumor Growth Analysis - User Manual

**Version:** 1.0 
**Application:** ViVo - In Vivo Tumor Growth Analysis Tool
**Date:** June 2025

---

## Table of Contents

1. [Introduction](#introduction)
2. [System Requirements](#system-requirements)
3. [Getting Started](#getting-started)
4. [Data Input Requirements](#data-input-requirements)
5. [Analysis Workflow](#analysis-workflow)
6. [Understanding Results](#understanding-results)
7. [Interactive Features](#interactive-features)
8. [Export and Reports](#export-and-reports)
9. [Troubleshooting](#troubleshooting)
10.[Best Practices](#best-practices)

---

## Introduction

ViVo is a web-based application for analyzing tumor growth data from in vivo experiments. It provides comprehensive analysis of tumor volume or bioluminescence measurements with advanced outlier detection, statistical comparisons, and interactive visualizations.

### Key Features

**Exponential Growth Modeling**: Automatic fitting of exponential models to individual animal data
**Intelligent Outlier Detection**: Multi-level anomaly detection with configurable sensitivity
**Interactive TGR Matrices**: Color-coded growth rate heatmaps with statistical comparisons
**Statistical Analysis**: Mann-Whitney U tests and effect size calculations
**Comprehensive Reports**: HTML reports with all analysis components
**Ready-to-use exports**: CSV data augmentation and generation  
**Data State Management**: Three analysis states for different filtering levels

---

## System Requirements

### Minimum Requirements
- **Web Browser**: Any modern browser supporting JavaScript ES6+, FileReader API, and CSS Grid
- **RAM**: 4GB minimum, 8GB recommended for large datasets
- **Internet Connection**: Required for initial loading (CDN dependencies: PapaParse, Plotly.js, jsPDF)

### Supported File Formats
- **CSV files** (.csv)
- **Text files** (.txt) with comma-separated values

---

## Getting Started

### 1. Opening the Application

1. Open `index.html` in your web browser
2. The application will automatically load required libraries
3. You'll see the ViVo interface with file upload area and control panels

### 2. Debug Mode (Optional)

Add `?debug=true` to the URL for enhanced logging and debugging features:
```
file:///path/index.html?debug=true
```

---

## Data Input Requirements

### Required Data Structure

Your CSV file must contain data in wide format with time points as columns:

```csv
Animal,Group,0,3,7,14,21
A001,Control,100.5,125.2,156.8,189.3,234.1
A002,Control,98.3,118.7,145.2,175.8,201.4
A003,Treatment,95.7,102.1,108.9,115.2,118.5
```

### Column Requirements

| Column | Description | Required | Format |
|--------|-------------|----------|--------|
| **Animal** | Animal identifier | Auto-generated if missing | Text/Number |
| **Group** | Treatment group | Defaults to "No group" | Text |
| **Time Points** | Numeric columns (0, 3, 7, etc.) | At least 3 time points | Numbers |

### Data Types Supported

- **Tumor Volume**: Measurements in mm³
- **BLI (Bioluminescence)**: Bioluminescence intensity values

### Data Quality Guidelines

**Include baseline** (Day 0 or earliest timepoint)
**Consistent group names** throughout the dataset  
**Positive values** (negative values will be flagged)
**At least 3 time points** per animal for model fitting
**Avoid excessive missing data**

---

## Analysis Workflow

### Step 1: Upload Data

1. **Drag and drop** your CSV file onto the upload area, or
2. **Click to browse** and select your file
3. The system will automatically detect data format and show file information

### Step 2: Configure Analysis

#### R² Threshold (0.0 - 1.0, Default: 0.8)
Controls exponential model fit quality acceptance:
- **0.7**: More lenient (pilot studies)
- **0.8**: Standard (recommended)
- **0.9**: Strict (high-quality studies)

#### Outlier Detection Configuration
- **Auto**: Automatically adjusts based on sample size (recommended)
- **Ultra-Conservative**: For pilot studies (n<5)
- **Conservative**: Standard studies (n=5-10)  
- **Moderate**: Large studies (n>10)

### Step 3: Run Analysis

1. Click **"Analyze Data"** to start processing
2. The system will perform:
   - Exponential model fitting
   - Outlier detection and flagging
   - Statistical group comparisons
3. Click **"Analyze Outliers"** to only analyze outliers in the dataset
4. Click **"Growth Matrices"** to generate Tumor Growth Rate (TGR) matrices
5. Click **"Predictions"** to open the tumor weight prediction panel

### Step 4: Review Results

Navigate through the generated analysis sections:
- Analysis Summary
- Group Statistics  
- Interactive Charts
- TGR Matrices
- Statistical Comparisons

---

## Understanding Results

### Analysis Summary

Shows overall data quality and key findings:
- **Total animals** and **valid animals** after filtering
- **Data type** detected (volume or BLI)
- **Control group** identification
- **R² distribution** for model fits

### Group Statistics

For each treatment group:
- **Sample sizes** (valid/total animals)
- **Average growth parameters** (r and V₀/BLI₀)
- **Standard errors** and confidence intervals
- **Relative errors** as quality indicators

### Growth Charts

#### Main Growth Curves
- Individual animal trajectories with exponential fits
- Color-coded by treatment group
- Interactive Plotly charts (zoom, pan, hover)

#### Normalized Growth Chart
- All animals scaled to common baseline
- Toggle between linear and logarithmic scales
- Useful for comparing growth patterns

### TGR (Tumor Growth Rate) Matrices

Color-coded heatmaps showing growth rates between time points:
- **Rows**: Starting time points
- **Columns**: Ending time points  
- **Colors**: Growth rate intensity (blue=green,, yellow=medium red=high)
- **Interactive**: Click cells for statistical comparisons

### Statistical Comparisons

When comparing matrix cells or groups:
- **Mann-Whitney U Test**: Non-parametric comparison
- **p-values**: Statistical significance
- **Cohen's d**: Effect size measure
- **Effect size interpretation**: Negligible/Small/Medium/Large

---

## Interactive Features

### Data State Management

Toggle between three analysis states using the state button:

1. **All Data**: No filtering applied
2. **Filtered Animals**: Excludes animals with critical anomalies
3. **Filtered Points**: Excludes individual problematic measurements

### TGR Matrix Interactions

1. **Select cells**: Click any matrix cell (blue border appears)
2. **Compare**: Select a second cell for automatic statistical comparison
3. **Deselect**: Click the same cell again to deselect
4. **View results**: Comparisons appear below matrices with detailed statistics

### Chart Controls

- **Scale Toggle**: Switch between linear and logarithmic scales
- **Color Scale**: Adjust matrix color ranges manually
- **Reset Scale**: Return to automatic color scaling

### Outlier Analysis

- **Detailed outlier panel**: Click "Analyze Outliers" for comprehensive analysis
- **Severity breakdown**: Critical, High, Medium, Low anomaly counts
- **Interactive filtering**: Toggle different outlier sensitivity levels

---

## Export and Reports

### Enhanced CSV Export

Click **"Export Enhanced CSV"** to download:
- Original data with calculated parameters
- Growth rates (r) and initial values (a₀)  
- R² values and model quality indicators
- Outlier flags and filtering decisions

### HTML Report Generation

Click **"Generate Report"** after analysis for comprehensive HTML including:
- **Executive Summary**: Key findings and recommendations
- **Analysis Details**: Statistical results and comparisons
- **Visual Components**: Charts and TGR matrices with legends
- **Outlier Analysis**: Detailed anomaly detection results

### TGR Data Export

Export growth rate matrices and statistical comparisons:
- Matrix data in CSV format:
   | Column | Description | Required | Format |
   |--------|-------------|----------|--------|
   | **Animal_ID** | Animal identifier | Text/Number |
   | **Experimental_Group** | Treatment group | Text |
   | **r(x-y)** | Tumor Growth rates | Numbers |
- Comparison results with p-values and effect sizes
- Ready for further analysis in other tools

---

## Troubleshooting

### Common Issues

#### File Upload Problems
**Symptoms**: File not loading, error messages  
**Solutions**:
- Verify CSV format matches requirements
- Check column headers are numeric for time points
- Ensure file encoding is UTF-8
- Remove special characters from data

#### Analysis Errors
**Symptoms**: "Analysis failed" or incomplete results  
**Solutions**:
- Ensure at least 3 time points per animal
- Check for positive measurement values only
- Verify consistent animal identifiers
- Include baseline measurements (Day 0)

#### Poor Model Fits
**Symptoms**: Many animals with R² below threshold  
**Solutions**:
- Lower R² threshold for exploratory analysis
- Check for measurement outliers affecting fits
- Consider if exponential model is appropriate
- Review data collection protocols

#### Performance Issues
**Symptoms**: Slow loading or processing  
**Solutions**:
- Limit datasets to <500 animals for optimal performance
- Close unnecessary browser tabs
- Ensure stable internet connection
- Use modern browser version

### Error Messages

- **"No valid data found"**: Check CSV format and data structure
- **"Insufficient time points"**: Need at least 3 time points per animal
- **"All animals filtered out"**: Adjust outlier sensitivity settings
- **"Matrix calculation failed"**: Check for missing or invalid data

---

## Best Practices

### Study Design
1. **Include adequate baseline**: At least Day 0 measurements
2. **Plan time points**: Balance frequency with animal welfare
3. **Standardize protocols**: Consistent measurement procedures
4. **Power calculations**: Ensure adequate group sizes

### Data Management
1. **Backup original data**: Keep unprocessed versions
2. **Document protocols**: Record experimental conditions
3. **Consistent naming**: Use standardized group and animal IDs
4. **Quality control**: Regular equipment calibration

### Analysis Strategy
1. **Start conservative**: Use conservative outlier settings initially
2. **Review flagged data**: Manually inspect outliers before exclusion
3. **Document decisions**: Record rationale for data handling
4. **Sensitivity analysis**: Test different configuration settings
5. **Biological context**: Consider biological plausibility of results

### Result Interpretation
1. **Statistical vs biological significance**: Both are important
2. **Model limitations**: Exponential models may not fit all patterns
3. **Effect sizes**: Consider practical significance beyond p-values
4. **Multiple comparisons**: Be aware of multiple testing issues

### Reporting Guidelines
1. **Export everything**: Save both data and reports
2. **Include methods**: Document analysis settings used
3. **Show data quality**: Report outlier detection results
4. **Transparent reporting**: Include both filtered and unfiltered results

---

## Technical Specifications

### Outlier Detection System

#### Anomaly Types Detected
- **Impossible Values**: Zero, negative, or extreme values
- **Extreme Growth**: Unrealistic growth rates
- **Extreme Decline**: Sudden large decreases  
- **Weak Signals**: Very low measurements
- **Last Day Drop**: End-point decreases
- **Intra-animal Outliers**: Within-animal statistical outliers
- **Group Outliers**: Between-animal anomalies

#### Severity Levels
- **Critical**: Always flagged (impossible values)
- **High**: Likely problematic (extreme changes)
- **Medium**: Suspicious (statistical outliers)
- **Low**: Minor concerns (boundary cases)

### Statistical Methods

#### Growth Modeling
- **Model**: N(t) = N₀ × e^(rt)
- **Fitting**: Linear regression on log-transformed data
- **Quality**: R² coefficient of determination

#### Group Comparisons
- **Test**: Mann-Whitney U (non-parametric)
- **Effect Size**: Cohen's d with interpretation
- **Significance**: Two-tailed p-values

### Performance Limits

Based on computational complexity analysis and external library constraints:

#### Recommended Limits (Optimal Performance)
- **Animals per group**: 30-50 animals
- **Time points**: 8-15 timepoints
- **Total animals**: 150-200 animals
- **Groups**: 4-6 groups
- **Processing time**: <10 seconds

#### Maximum Practical Limits (Acceptable Performance)
- **Animals per group**: 100 animals (performance degradation expected)
- **Time points**: 20-25 timepoints (matrices become large)
- **Total animals**: 500 animals
- **File size**: Limited by browser memory (~500MB CSV)
- **Processing time**: 30-120 seconds

#### Critical Limitations
- **TGR Matrix Complexity**: O(n×m²) scaling - performance degrades rapidly with >20 timepoints
- **Plotly.js Charts**: SVG rendering limits ~15k data points, memory usage can exceed 1GB
- **Browser Memory**: Large datasets (>500 animals, >20 timepoints) may cause browser freezing
- **DOM Limitations**: Matrix visualizations with >25 timepoints create hundreds of interactive elements

#### Warning Thresholds
- **>200 total animals**: Expect slower processing
- **>20 timepoints**: Matrix visualization becomes unwieldy
- **>50 animals per group**: Statistical comparisons may timeout

---

*This manual describes ViVo version 1.0 with comprehensive tumor growth analysis capabilities. For additional support, refer to the application's built-in help tooltips and debug mode.*