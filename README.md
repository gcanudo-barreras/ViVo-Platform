<div align="center"><img src="Assets/ViVo_day.png" alt="ViVo Logo" height="250"/></div>

<p align="center>"A comprehensive web-based application for analyzing in vivo anticancer efficacy data through advanced statistical methods and interactive visualizations.</p>

Open source tool designed to standardize in vivo efficacy analysis, improve research reproducibility, and reduce animal usage.

## Features

### Core Functionality
- **Data Import**: Support for CSV files with tumor volume or bioluminescence measurements
- **Exponential Regression Analysis**: Automatic fitting with R² threshold filtering
- **Growth Rate Matrices (TGR)**: Interactive visualization of tumor growth rates
- **Data Predictions**: Basic forecasting based on regression models
- **Statistical Comparisons**: Mann-Whitney U tests with effect size calculations
- **HTML Reports**: Reports with embedded charts and statistical analysis

### Advanced Analytics
- **Scientific Setup Wizard**: Guided configuration based on study type and experimental parameters
- **Outlier Detection**: Detection and filtering of anomalous data points
- **Interactive Filtering**: Animal-level and data point-level filtering options
- **Normalized Visualization**: Multiple normalization methods for comparative analysis
- **Color-coded TGR Matrices**: Customizable color scales for growth rate visualization
- **Statistical Testing**: Mann-Whitney U tests for group comparisons

### User Experience
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Dynamic chart updates and interactive elements
- **Export Functionality**: CSV export for matrices and statistical results
- **HTML Reports**: Reports with embedded visualizations
- **Web Interface**: Browser-based data processing workflow

## Data Requirements

### Input Format
The application accepts CSV files with the following structure:

| Animal_ID |   Group   |   0   |   7   |   14   |   21   | ... | Tumor_Weight |
|-----------|-----------|-------|-------|--------|--------|-----|--------------|
| Animal_1  |  Control  |  100  |  150  |   200  |   300  | ... |     0.60     |
| Animal_2  | Treatment |   95  |  120  |   140  |   160  | ... |     0.35     |

### Data Types Supported
- **Tumor Volume**: Measurements in mm³
- **Bioluminescence**: Intensity measurements (BLI)

### Sample Datasets
The repository includes example datasets for testing and templates for data formatting:
- `tumorgrowth_controlVSdrug_day18.csv` - Sample tumor volume data from Daskalakis dataset
- `ViVo_basic_dataset_TEMPLATE.csv` - Sample tumor volume data
- `ViVo_dataset_with_weights_TEMPLATE.csv` - Sample tumor volume data with tumor weights

## Technical Specifications

### Technologies Used
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Visualization**: Plotly.js for interactive charts
- **Data Processing**: Papa Parse for CSV handling
- **Statistical Analysis**: Custom implementation of Mann-Whitney U test
- **Responsive Framework**: Custom CSS Grid and Flexbox layouts

### Browser Compatibility
Any modern browser supporting JavaScript ES6+, FileReader API, and CSS Grid

### Performance Features
- **Client-side Processing**: All calculations performed locally in the browser
- **Interactive Visualizations**: Real-time chart updates and responsive interface
- **Large Dataset Support**: Handles datasets with hundreds of animals and time points
- **Modern JavaScript**: ES6+ features for efficient data processing

### Technical Requirements
- **JavaScript Required**: Full functionality requires JavaScript enabled
- **Local Processing**: All data processing occurs in the browser (no server required)
- **Memory Considerations**: Large datasets (>1000 data points) may require sufficient RAM

### Current Limitations
- **File Format**: CSV/TXT files are supported
- **Statistical Methods**: Limited to Mann-Whitney U test and basic descriptive statistics
- **Data Size**: Performance may degrade with very large datasets (>10,000 data points)
- **Browser Dependent**: Some features may work differently across browsers
- **Single Session**: No data persistence between sessions

## Scientific Methods

### Scientific Setup Wizard

The application includes an intelligent configuration wizard that automatically adjusts analysis parameters based on scientific best practices and study characteristics.

#### Adaptive Configuration Algorithm

The wizard implements a tiered approach to parameter optimization:

**Study Type Configuration (Base Parameters):**
- Sample Size Adaptation: Parameters adjust automatically based on statistical power requirements
- Quality vs. Power Trade-off: Smaller studies use more permissive criteria to preserve data
- Scalable Stringency: Larger cohorts enable stricter quality control without power loss

**Parameter Ranges:**
- R² Thresholds: 0.70-0.90 depending on study characteristics
- Outlier Sensitivity: Ultra Conservative to Conservative to Moderate
- Filtering Levels: Critical Only to Critical+High to All Anomalies

#### Technical and Biological Variability Compensation

**Measurement Method Adjustments:**
- Direct Measurements (Caliper): Higher precision expectations (+0.05 R² adjustment)
- Imaging Systems (BLI/IVIS): Accounts for technical variability (-0.05 R² adjustment)

**Biological Context Integration:**
- Immunodeficient Models: Lower variability tolerance (standard sensitivity)
- Immunocompetent Models: Higher variability tolerance (increased sensitivity)
- Patient-Derived Models: Maximum variability tolerance (highest sensitivity + additional R² relaxation)

#### Configuration Boundaries

The wizard operates within scientifically validated parameter ranges:

**Maximum Permissive (Pilot/Exploratory Studies):**
- Optimizes for data retention and hypothesis generation
- Implements ARRIVE Guidelines 2.0 for small sample studies

**Balanced Standard (Publication Studies):**
- Follows established statistical practices in oncology research
- Balances rigor with practical data inclusion

**Maximum Stringent (High-Precision Studies):**
- Enables strict quality control for large datasets
- Suitable for definitive efficacy determinations

### Tumor Growth Rate Calculation
Tumor Growth Rate (TGR) is calculated using the formula:
```
r(x→y) = ln(N_y / N_x) / (t_y - t_x)
```
Where:
- `N_x`, `N_y` are data points at times x and y
- `t_x`, `t_y` are the corresponding time points

### Statistical Analysis
- **Mann-Whitney U Test**: Non-parametric comparison between groups
- **Effect Size**: Cohen's d calculation for practical significance
- **Multiple Comparisons**: Automatic prevention of duplicate analyses
- **Scientific Validation**: All methods follow ARRIVE Guidelines 2.0

### Outlier Detection
Intelligent algorithms identify:
- Measurement Errors: Inconsistent or impossible values
- Growth Anomalies: Unusual growth patterns deviating from expected biology
- Technical Artifacts: Instrument-related errors and systematic biases
- Adaptive Thresholds: Detection sensitivity adjusts based on study characteristics

### Scientific References Integration
The wizard automatically applies configurations based on:
- ARRIVE Guidelines 2.0 (Percie du Sert et al., 2020)
- NC3Rs Guidelines for experimental design
- Statistical best practices in oncology research
- Established imaging practices for BLI analysis

## Core Features

### TGR Matrix Functionality
- Duplicate comparison prevention
- Clear All button
- Comparison titles showing actual r(x-y) values
- Matrix display with optimized layout

### Statistical Comparisons
- Prevention of duplicate statistical comparisons
- Automated comparison validation
- User feedback and notifications
- Comprehensive comparison result display

### Report Generation
- Clean matrix presentation
- Statistical comparison labeling
- Visual presentation with embedded charts
- HTML and CSV export capabilities

### User Experience
- Intuitive interactions with clear visual feedback
- Smart validation preventing invalid operations
- Cross-platform compatibility (desktop and mobile browsers)
- Real-time data processing and visualization

## Usage Instructions

### Getting Started
1. **Open the Application**: Load `index.html` in a modern web browser
2. **Scientific Setup** (Recommended): Use the Configuration Manager for guided configuration based on your study characteristics
3. **Import Data**: Click "Choose CSV File" and select your dataset
4. **Configure Analysis**: Adjust parameters manually or use Configuration Manager
5. **Review Results**: Examine the exponential fits and statistical summaries
6. **Generate Matrices**: Create TGR matrices for comparative analysis
7. **Export Results**: Generate comprehensive reports or export data

### Data Analysis Workflow
1. **Scientific Configuration** (using Configuration Manager for optimal parameters)
2. **Data Import and Validation**
3. **Outlier Detection and Filtering**
4. **Exponential Regression Analysis**
5. **Growth Rate Matrix Generation**
6. **Statistical Comparisons** (with appropriate filtering levels)
7. **Report Generation and Export**

### Advanced Features
- Configuration Manager: Automatically configures analysis parameters based on study type, endpoint, and model characteristics
- Adaptive Configuration: Parameters adjust intelligently based on sample size, measurement method, and biological context
- Custom Filtering: Filter by animals or individual data points with wizard-recommended sensitivity
- TGR Matrix Comparisons: Click matrix elements to compare specific growth rates with appropriate statistical methods
- Prediction Modeling: Forecast future time points based on fitted models
- Color Scale Customization: Adjust matrix visualization scales

## File Structure

```
ViVo-Platform/
├── index.html                                    # Main application file
├── css/
│   ├── styles.css                                # Main stylesheet
│   ├── tutorial-styles.css                       # Tutorial system styles
│   └── scientific-wizard.css                     # Scientific Setup Wizard styles
├── js/
│   ├── core/
│   │   ├── AnalysisController.js                 # Core analysis coordination
│   │   ├── AppState.js                           # Application state management
│   │   ├── AppUtilities.js                       # Utility functions
│   │   ├── ApplicationController.js              # Main application controller
│   │   ├── ChartPoolManager.js                   # Chart management system
│   │   ├── DOMCache.js                           # DOM element caching
│   │   ├── EventManager.js                       # Event handling system
│   │   ├── FastMath.js                           # Optimized mathematical operations
│   │   ├── FormChangeHandler.js                  # Form interaction handling
│   │   ├── MathUtils.js                          # Mathematical utility functions
│   │   ├── ModalSystem.js                        # Modal dialog management
│   │   ├── NotificationService.js                # User notification system
│   │   ├── SystemIntegrator.js                   # System integration layer
│   │   ├── UIManager.js                          # User interface management
│   │   ├── WorkerManager.js                      # Web worker coordination
│   │   ├── WorkerUtility.js                      # Worker utility functions
│   │   └── system-bootstrap.js                   # System initialization
│   ├── services/
│   │   ├── ChartService.js                       # Chart generation and management
│   │   ├── ExportManager.js                      # Data export functionality
│   │   ├── GitHubIssuesService.js                # GitHub integration
│   │   ├── PredictionService.js                  # Predictive modeling
│   │   ├── ReportGenerator.js                    # Report generation
│   │   ├── ScientificWizardService.js            # Scientific configuration wizard
│   │   ├── TGRMatricesService.js                 # TGR matrix calculations
│   │   └── TutorialSystem.js                     # Interactive tutorial system
│   ├── workers/
│   │   ├── DataAnalysisWorker.js                 # Background data analysis
│   │   ├── OutlierDetectionWorker.js             # Background outlier detection
│   │   └── TGRCalculationWorker.js               # Background TGR calculations
│   ├── IntelligentOutlierDetector.js             # Outlier detection algorithms
│   └── ModelHomogeneityEvaluator.js              # Model homogeneity analysis
├── Datasets/
│   ├── ViVo_basic_dataset_TEMPLATE.csv           # Basic dataset template
│   ├── ViVo_dataset_with_weights_TEMPLATE.csv    # Dataset template with weights
│   └── tumorgrowth_controlVSdrug_day18.csv       # Example Daskalakis dataset
├── ViVo_USER_MANUAL.md                           # Comprehensive user manual
└── README.md                                     # This file
```

## Contributing

This is a research tool developed for scientific analysis. For questions, suggestions, or collaboration:

1. **Issues**: Report bugs or suggest features via GitHub Issues (there is a Report option in the web-app)
2. **Documentation**: Help improve documentation and examples
3. **Testing**: Test with different datasets and provide feedback

## Developers  
List of main developers and contact emails:  
  - [Guillermo Canudo-Barreras](https://orcid.org/0000-0002-1949-9185). Contact: [canudobarreras@unizar.es](mailto:canudobarreras@unizar.es)  

## Scientific Contributors
The mathematical methodology implemented in this software was developed collaboratively in the following research work:
  - [Eduardo Romanos](https://orcid.org/0000-0002-9918-3374). Contact: [eromanos.iacs@aragon.es](mailto:eromanos.iacs@aragon.es)
  - [Raquel P. Herrera](https://orcid.org/0000-0002-5244-9569). Contact [raquelph@unizar.es](mailto:raquelph@unizar.es)
  - [M. Concepción Gimeno](https://orcid.org/0000-0003-0553-0695). Contact [gimeno@unizar.es](mailto:gimeno@unizar.es)

For details, please refer to the original publication:

Canudo-Barreras, G.; Romanos, E.; Herrera, R. P.; Gimeno, M. C. *ViVo: A temporal modeling framework that boosts statistical power and minimizes animal usage*. *bioRxiv*, **2025**. DOI: https://doi.org/10.1101/2025.10.14.682266

## License

This software is developed for research purposes under the MIT License. Please cite appropriately when used in scientific publications.

## Research Applications

- **Preclinical Studies**: Drug efficacy evaluation
- **Comparative Analysis**: Treatment comparison studies
- **Longitudinal Analysis**: Time-course studies
- **Publication Support**: Research paper figure generation

## Support

For technical support or scientific questions:
- **Documentation**: Refer to this README and the user manual
- **Issues**: Use GitHub Issues for bug reports or contact directly to the main developer
- **Research Collaboration**: Contact for scientific partnerships

---

**ViVo Platform** - In ViVo Metrics

*Version Research Beta 1.0*
