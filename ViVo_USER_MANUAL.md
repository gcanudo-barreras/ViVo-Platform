# ViVo: In Vivo Tumor Growth Analysis - User Manual

**Version:** Research Beta 1.0  
**Application:** ViVo - In Vivo Tumor Growth Analysis Tool  
**Date:** August 2025

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
10. [Best Practices](#best-practices)

---

## Introduction

ViVo is a web-based application for analyzing tumor growth data from in vivo experiments. It provides comprehensive analysis of tumor volume or bioluminescence measurements with exponential modeling, advanced outlier detection, statistical comparisons, and interactive visualizations.

### Key Features

- Scientific Configuration Assistant: Automated configuration based on study type, endpoint, and animal model characteristics
- Exponential Growth Modeling: Automatic fitting of exponential models to individual animal data
- Intelligent Outlier Detection: Multi-level anomaly detection with configurable sensitivity
- Interactive TGR Matrices: Color-coded growth rate heatmaps with statistical comparisons
- Statistical Analysis: Mann-Whitney U tests and effect size calculations
- Comprehensive Reports: HTML reports print-ready with all analysis components
- Ready-to-use exports: CSV data augmentation and generation
- Data State Management: Three analysis states for different filtering levels

---

## System Requirements

### Minimum Requirements
- **Web Browser**: Any modern browser supporting JavaScript ES6+, FileReader API, and CSS Grid
- **RAM**: 2GB minimum for basic datasets (<100 animals), 4GB recommended for typical studies, 8GB+ for large datasets (>500 animals)
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
4. **Recommended**: Click "Configuration Manager" to configure optimal analysis parameters for your study

### 2. Configuration Manager (Recommended First Step)

The Configuration Manager guides you through optimal parameter configuration based on your study characteristics:

#### Step 1: Study Type Selection
Choose the option that best describes your study:
- Pilot Efficacy Study: For exploratory studies with small sample sizes (n=5-8 per group)
- Standard Efficacy Study: For typical efficacy studies (n=8-12 per group) [Most Common]
- Large Cohort Study: For studies with large sample sizes (n>12 per group)

#### Step 2: Primary Endpoint
Select your measurement method:
- Tumor Volume (Caliper): If you measured tumor dimensions with calipers
- Bioluminescence (BLI/IVIS): If you used bioluminescence imaging

#### Step 3: Animal Model Context  
Choose your experimental model:
- Xenograft (Immunodeficient): Human cells in immunodeficient mice
- Syngeneic (Immunocompetent): Mouse cells in immunocompetent mice
- PDX (Patient-Derived Xenografts): Patient tumor samples in mice
- Not sure/Standard: If uncertain, use this balanced option

#### Step 4: Configuration Summary
Review the automatically generated settings:
- R² Threshold: Quality threshold for accepting exponential fits
- Outlier Detection: Sensitivity level for anomaly detection
- Filtering Level: Which types of outliers will be excluded
- Scientific Rationale: Why these settings are recommended for your study type

Click "Apply Configuration" to use these optimized settings for your analysis.

---

## Data Input Requirements

### Required Data Structure

Your CSV file must contain data in wide format with time points as columns:

```csv/txt
Animal,Group,0,3,7,14,21,Tumor_Weight
A001,Control,100.5,125.2,156.8,189.3,234.1,0.4
A002,Control,98.3,118.7,145.2,175.8,201.4,0.5
A003,Treatment,95.7,102.1,108.9,115.2,118.5,0.35
```

### Column Requirements

| Column | Description | Required | Format |
|--------|-------------|----------|--------|
| **Animal** | Animal identifier | Auto-generated if missing | Text/Number |
| **Group** | Treatment group | Defaults to "No group" | Text |
| **Time Points** | Numeric columns (0, 3, 7, etc.) | At least 3 time points | Numbers |
| **Tumor_weight** | Tumor weight (e.g. 0.4) | Number |

### Data Types Supported

- **Tumor Volume**: Measurements in mm³
- **BLI (Bioluminescence)**: Bioluminescence intensity values

### Data Quality Guidelines

- Include baseline (Day 0 or earliest timepoint)
- Consistent group names throughout the dataset
- Positive values (negative values will be flagged)
- At least 3 time points per animal for model fitting
- Avoid excessive missing data

---

## Analysis Workflow

### Step 1: Configure Analysis (Recommended: Use Configuration Manager First)

#### Configuration Manager Settings
Use the Configuration Manager to automatically configure optimal parameters based on:
- **Study Type**: Pilot/Standard/Large Cohort
- **Measurement Method**: Volume/BLI
- **Animal Model**: Xenograft/Syngeneic/PDX
- **Automatic Parameter Optimization**: R² thresholds, outlier sensitivity, and filtering levels

#### Manual Configuration (Alternative)

R² Threshold (0.0 - 1.0)
Controls exponential model fit quality acceptance:
- Configuration Manager: Automatically optimized (recommended)
- 0.7: More lenient (pilot studies, BLI data)
- 0.8: Standard (recommended for most studies)
- 0.9: Strict (high-quality studies, precise measurements)

Outlier Detection Configuration
- Configuration Manager: Study-type appropriate sensitivity (recommended)
- Auto: Automatically adjusts based on sample size
- Ultra-Conservative: For pilot studies or high-variability models
- Conservative: Standard studies
- Moderate: Large studies with precise measurements

### Step 2: Upload Data

1. Drag and drop your CSV/TXT file onto the upload area, or
2. Click to browse and select your file
3. The system will automatically detect data format and show file information
4. Data Type Auto-Detection: If you used the Configuration Manager, data type will be automatically set

### Step 3: Run Analysis

1. Click "Analyze Data" to start processing with configured parameters
2. The system will perform:
   - Model homogeneity evaluation
   - Outlier detection and flagging with study-appropriate sensitivity
   - Exponential model fitting with optimized R² thresholds
   - Statistical group comparisons using best practices
3. Click "TGR Matrices" to generate Tumor Growth Rate (TGR) matrices
4. Click "Predictions" to open the tumor weight prediction panel
5. Access configuration anytime, and then click "Analyze Data" to reconfigure parameters for different analyses

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
- Total animals and valid animals after filtering
- Data type detected (volume or BLI)
- Control group identification
- R² distribution for model fits

### Group Statistics

For each treatment group:
- Sample sizes (valid/total animals)
- Average growth parameters (r and V₀/BLI₀)
- Standard errors and confidence intervals
- Relative errors as quality indicators

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
- Rows: Starting time points
- Columns: Ending time points
- Colors: Growth rate intensity (green=low, yellow=medium, red=high)
- Interactive: Click cells for statistical comparisons

### Statistical Comparisons

When comparing matrix cells or groups:
- Mann-Whitney U Test: Non-parametric comparison
- p-values: Statistical significance
- Cohen's d: Effect size measure
- Effect size interpretation: Negligible/Small/Medium/Large

---

## Interactive Features

### Data State Management

Toggle between three analysis states using the state button:

1. All Data: No filtering applied
2. Filtered Animals: Excludes animals with critical anomalies
3. Filtered Points: Excludes individual problematic measurements (point-level outlier filtering)

### TGR Matrix Interactions

1. Select cells: Click any matrix cell (white border appears)
2. Compare: Select a second cell for automatic statistical comparison
3. Deselect: Click the same cell again to deselect
4. View results: Comparisons appear below matrices with detailed statistics

### Chart Controls

- Scale Toggle: Switch between linear and logarithmic scales
- Color Scale: Adjust matrix color ranges manually with interactive min/max controls
- Reset Scale: Return to automatic color scaling
- Keyboard Controls: Use keyboard inputs for precise color scale adjustment

### Outlier Analysis

- Detailed outlier panel
- Severity breakdown: Critical, High, Medium, Low anomaly counts
- Interactive filtering: Toggle different outlier sensitivity levels

### Configuration Manager
The Configuration Manager simplifies analysis configuration by asking about your study and automatically setting optimal parameters:

How It Works:
1. Answer 3 simple questions about your study type, measurement method, and animal model
2. Review generated configuration with scientific rationale
3. Apply settings automatically to your analysis
4. Start analyzing with confidence in scientifically-appropriate parameters

Key Benefits:
- No guesswork: Eliminates uncertainty about which settings to use
- Science-based: All configurations follow established best practices
- Time-saving: Instant setup instead of manual parameter testing
- Beginner-friendly: No expertise needed in statistical configuration

---

## Export and Reports

### Enhanced CSV Export

Click "Export CSV" to download:
- Original data with calculated parameters
- Growth rates (r) and initial values (V₀/BLI₀)
- R² values and model quality indicators

### HTML Report Generation

Click "Generate Report" after analysis for comprehensive HTML including:
- Executive Summary: Key findings and recommendations
- Analysis Details: Statistical results and comparisons
- Visual Components: Charts and TGR matrices with legends
- Homogeneity Analysis: Detailed homogeneity summary with group and averaged Coefficient of Variation (CV) and Homogeneity Quality Score
- Outlier Analysis: Detailed anomaly detection results

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

### Batch Weight Prediction Export

Export tumor weight predictions for multiple scenarios:
- Batch prediction results: Predicted weights for different time points
- Statistical comparisons: Mann-Whitney U tests between predicted scenarios
- Quality metrics: Model fit statistics and confidence intervals

---

## Troubleshooting

### Common Issues

#### File Upload Problems
Symptoms: File not loading, error messages
Solutions:
- Verify CSV format matches requirements
- Check column headers are numeric for time points
- Ensure file encoding is UTF-8
- Remove special characters from data

#### Analysis Errors
Symptoms: "Analysis failed" or incomplete results
Solutions:
- Use Configuration Manager: Many issues resolve with appropriate parameter configuration
- Ensure at least 3 time points per animal
- Check for positive measurement values only
- Verify consistent animal identifiers
- Include baseline measurements (Day 0)

#### Configuration Manager Issues
Symptoms: Unsure which options to select
Solutions:
- When in doubt, choose "Standard Study": Most common and well-balanced
- Not sure about model type?: Select "Not sure/Standard" for balanced settings
- Mixed measurement methods?: Choose the primary/most abundant measurement type
- Sample size varies by group?: Use the average sample size to guide study type selection

#### Poor Model Fits
Symptoms: Many animals with R² below threshold
Solutions:
- Try "Pilot Study" in Configuration Manager: Uses more permissive R² thresholds
- Check your measurement method: BLI studies typically need lower thresholds than volume
- Consider your model type: PDX models have higher acceptable variability
- Check for measurement outliers affecting fits
- Consider if exponential model is appropriate
- Review data collection protocols

#### Performance Issues
Symptoms: Slow loading or processing
Solutions:
- Limit datasets to <500 animals for optimal performance
- Close unnecessary browser tabs
- Ensure stable internet connection
- Use modern browser version

### Error Messages

- "No valid data found": Check CSV/TXT format and data structure
- "Insufficient time points": Need at least 3 time points per animal
- "All animals filtered out": Adjust outlier sensitivity settings
- "Matrix calculation failed": Check for missing or invalid data

---

## Best Practices

### Study Design
1. **Include adequate baseline**: At least Day 0 measurements (or close enough)
2. **Plan time points**: Balance frequency with animal welfare
3. **Standardize protocols**: Consistent measurement procedures
4. **Power calculations**: Ensure adequate group sizes

### Data Management
1. **Backup original data**: Keep unprocessed versions
2. **Document protocols**: Record experimental conditions
3. **Consistent naming**: Use standardized group and animal IDs
4. **Quality control**: Regular equipment calibration

### Analysis Strategy
1. **Use Configuration Manager**: Start with wizard-generated configuration appropriate for your study
2. **Understand configuration**: Review the scientific rationale provided by the Configuration Manager
3. **Review flagged data**: Manually inspect outliers before exclusion
4. **Document decisions**: Record rationale for data handling and configuration used
5. **Sensitivity analysis**: Test different configurations if study characteristics are uncertain
6. **Biological context**: Consider biological plausibility of results within your model system

### Practical Configuration Examples

#### Example 1: "My preliminary drug screening study"
Your Study: Testing 3 compounds, n=5 mice per group, used IVIS bioluminescence, syngeneic 4T1 model
Configuration Manager Selections: Pilot Study → Bioluminescence → Syngeneic
Result: R² threshold 0.70, very sensitive outlier detection, keeps most data for exploration
When to Use: Early drug discovery, proof-of-concept studies, limited animal availability

#### Example 2: "My publication-ready efficacy study"
Your Study: Lead compound vs vehicle, n=10 mice per group, caliper measurements, subcutaneous xenografts
Configuration Manager Selections: Standard Study → Tumor Volume → Xenograft
Result: R² threshold 0.85, balanced outlier detection, excludes problematic data points
When to Use: Manuscript preparation, regulatory submissions, definitive efficacy claims

#### Example 3: "My comprehensive dose-response study"
Your Study: 5 dose levels + control, n=12-15 mice per group, caliper measurements, xenograft model
Configuration Manager Selections: Large Cohort → Tumor Volume → Xenograft
Result: R² threshold 0.90, moderate outlier sensitivity, strict quality control
When to Use: Dose-response characterization, pharmacology studies, high-precision requirements

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
- Impossible Values: Zero, negative, or extreme values
- Extreme Growth: Unrealistic growth rates
- Extreme Decline: Sudden large decreases
- Intra-animal Outliers: Within-animal statistical outliers
- Group Outliers: Between-animal anomalies
- Last Day Drop: End-point decreases

#### Severity Levels
- Critical: Always flagged (impossible values)
- High: Likely problematic (extreme changes)
- Medium: Suspicious (statistical outliers)
- Low: Minor concerns (boundary cases)

### Statistical Methods

#### Growth Modeling
- Model: N(t) = N₀ × e^(rt)
- Fitting: Linear regression on log-transformed data
- Quality: R² coefficient of determination

#### Group Comparisons
- Test: Mann-Whitney U (non-parametric)
- Effect Size: Cohen's d with interpretation
- Significance: Two-tailed p-values

### Performance Limits

Based on computational complexity analysis and external library constraints:

#### Recommended Limits (Optimal Performance)
- Animals per group: 30-50 animals
- Time points: 8-15 timepoints
- Total animals: 150-200 animals
- Groups: 4-6 groups
- Processing time: <10 seconds

#### Maximum Practical Limits (Acceptable Performance)
- Animals per group: 100 animals (performance degradation expected)
- Time points: 20-25 timepoints (matrices become large)
- Total animals: 500 animals
- File size: Limited by browser memory (~500MB CSV)
- Processing time: 30-120 seconds

#### Critical Limitations
- TGR Matrix Complexity: O(n×m²) scaling - performance degrades rapidly with >20 timepoints
- Plotly.js Charts: SVG rendering limits ~15k data points, memory usage can exceed 1GB
- Browser Memory: Large datasets (>500 animals, >20 timepoints) may cause browser freezing
- DOM Limitations: Matrix visualizations with >25 timepoints create hundreds of interactive elements

#### Warning Thresholds
- >200 total animals: Expect slower processing
- >20 timepoints: Matrix visualization becomes unwieldy
- >50 animals per group: Statistical comparisons may timeout

---

## Quick Reference: Configuration Manager

### Fast Track Setup (Most Users)
1. Click "Configuration Manager" when you first open ViVo
2. Select "Standard Efficacy Study" (works for most research)
3. Choose your measurement method: Volume or BLI
4. Select your model type (or choose "Not sure" if uncertain)
5. Click "Apply Configuration"
6. Upload your CSV file
7. Click "Analyze Data"

### Common Configuration Combinations
| Study Type | Measurement | Model | Best For |
|------------|-------------|-------|----------|
| Standard | Volume | Xenograft | Most common efficacy studies |
| Pilot | BLI | Syngeneic | Early screening, immunocompetent models |
| Large Cohort | Volume | Xenograft | Definitive studies, dose-response |
| Standard | BLI | PDX | Patient-derived model studies |

### When NOT to Use the Configuration Manager
- Custom analysis needs: If you have specific R² requirements
- Non-standard studies: Unusual experimental designs
- Experienced users: Who prefer manual parameter control
- Comparative analysis: When comparing different parameter settings

---

*This manual describes ViVo version Research Beta 1.0 capabilities. For additional support, refer to the application's built-in help tooltips and report mode.*