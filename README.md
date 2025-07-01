<div align="center"><img src="assets/ViVo_day.png" alt="ViVo Logo" height="300"/></div>

<p align="center>"A comprehensive web-based application for analyzing in vivo anticancer efficacy data through advanced statistical methods and interactive visualizations.</p>

## Features

### Core Functionality
- **Data Import**: Support for CSV files with tumor volume or bioluminescence measurements
- **Exponential Regression Analysis**: Automatic fitting with R² threshold filtering
- **Growth Rate Matrices (TGR)**: Interactive visualization of tumor growth rates
- **Statistical Comparisons**: Mann-Whitney U tests with effect size calculations
- **HTML Reports**: Reports with embedded charts and statistical analysis
- **Data Predictions**: Basic forecasting based on regression models

### Advanced Analytics
- **Outlier Detection**: Detection and filtering of anomalous data points
- **Interactive Filtering**: Animal-level and data point-level filtering options
- **Normalized Visualization**: Multiple normalization methods for comparative analysis
- **Color-coded Matrices**: Customizable color scales for growth rate visualization
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

| Animal_ID | Group | 0 | 7 | 14 | 21 | ... |
|-----------|-------|-------|-------|--------|--------|-----|
| Animal_1  | Control | 100 | 150 | 200 | 300 | ... |
| Animal_2  | Treatment_A | 95 | 120 | 140 | 160 | ... |

### Data Types Supported
- **Tumor Volume**: Measurements in mm³
- **Bioluminescence**: Intensity measurements (BLI)

### Sample Datasets
The repository includes example datasets for testing:
- `Daskalakis_18-days_dataset.csv` - Sample tumor volume data
- `4T1-progression-early_dataset.csv` - Sample bioluminescence data
- `4T1-progression-late_dataset.csv` - Sample tumor volume data

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
- **File Format**: Only CSV files are supported (not TXT or other formats)
- **Statistical Methods**: Limited to Mann-Whitney U test and basic descriptive statistics
- **Data Size**: Performance may degrade with very large datasets (>10,000 data points)
- **Browser Dependent**: Some features may work differently across browsers
- **Single Session**: No data persistence between sessions

## Scientific Methods

### Statistical Analysis
- **Mann-Whitney U Test**: Non-parametric comparison between groups
- **Effect Size**: Cohen's d calculation for practical significance
- **Multiple Comparisons**: Basic comparison functionality
- **Effect Size**: Cohen's d calculations

### Outlier Detection
Basic detection algorithms identify:
- **Measurement Errors**: Inconsistent or impossible values
- **Growth Anomalies**: Unusual growth patterns
- **Technical Artifacts**: Instrument-related errors

## Key Improvements in Version 1.2

### New Features
- **Enhanced Matrix Functionality**: 
  - Duplicate comparison prevention
  - Smart Clear All button (only active when needed)
  - Improved comparison titles showing actual r(x-y) values
  - Matrix display matches software layout (removed empty diagonal elements)

- **Advanced Statistical Comparisons**:
  - Prevention of duplicate statistical comparisons
  - Automated comparison validation
  - Enhanced user feedback and notifications
  - Improved comparison result display

- **Professional Report Generation**:
  - Clean matrix presentation without empty elements
  - Proper statistical comparison labeling
  - Enhanced visual presentation
  - Embedded chart capture

### User Experience Enhancements
- **Intuitive Interactions**: Clear visual feedback for all user actions
- **Smart Validation**: Automatic prevention of invalid operations
- **HTML Output**: Reports and CSV exports
- **Cross-platform**: Works on desktop and mobile browsers

## Usage Instructions

### Getting Started
1. **Open the Application**: Load `index.html` in a modern web browser
2. **Import Data**: Click "Choose CSV File" and select your dataset
3. **Configure Analysis**: Set R² threshold and select data type (Volume/BLI)
4. **Review Results**: Examine the exponential fits and statistical summaries
5. **Generate Matrices**: Create TGR matrices for comparative analysis
6. **Export Results**: Generate comprehensive reports or export data

### Data Analysis Workflow
1. **Data Import and Validation**
2. **Outlier Detection and Filtering** (optional)
3. **Exponential Regression Analysis**
4. **Growth Rate Matrix Generation**
5. **Statistical Comparisons** (if multiple groups)
6. **Report Generation and Export**

### Advanced Features
- **Custom Filtering**: Filter by animals or individual data points
- **Matrix Comparisons**: Click matrix elements to compare specific growth rates
- **Prediction Modeling**: Forecast future time points based on fitted models
- **Color Scale Customization**: Adjust matrix visualization scales

## File Structure

```
ViVo-Platform/
├── index.html                            # Main application file
├── assets/                               #Logos
|   ├── ViVo.png
│   └── ViVo_day.png
├── css/
│   └── styles.css                        # Stylesheet
├── datasets/                             # Sample datasets
│   ├── Daskalakis_18-days_dataset.csv
|   ├── 4T1-progression-late_dataset.csv
│   └── 4T1-progression-early_dataset.csv
├── docs/                                 # Documents
│   └── ViVo_USER_MANUAL.md
├── js/
│   └── intelligent_outlier_detector.js   # Outlier detection
├── LICENSE
└── README.md                             # This file
```

## Contributing

This is a research tool developed for scientific analysis. For questions, suggestions, or collaboration:

1. **Issues**: Report bugs or suggest features via GitHub Issues
2. **Documentation**: Help improve documentation and examples
3. **Testing**: Test with different datasets and provide feedback
4. **Translation**: Assist with internationalization efforts

## Developers  
List of main developers and contact emails:  
  - [ ] [Guillermo Canudo-Barreras](https://orcid.org/0000-0002-1949-9185). Contact: [canudobarreras@unizar.es](mailto:canudobarreras@unizar.es)  
  - [ ] [Eduardo Romanos](https://orcid.org/0000-0002-9918-3374). Contact: [eromanos.iacs@aragon.es](mailto:eromanos.iacs@aragon.es)
  - [ ] [Raquel P. Herrera](https://orcid.org/0000-0002-5244-9569). Contact [raquelph@unizar.es](mailto:raquelph@unizar.es)
  - [ ] [M. Concepción Gimeno](https://orcid.org/0000-0003-0553-0695). Contact [gimeno@unizar.es](mailto:gimeno@unizar.es)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. Please cite appropriately when used in scientific publications.

## Potential Enhancements

### Possible Future Features
- **Multi-study Analysis**: Compare results across different experiments
- **Additional Statistics**: More statistical tests and methods
- **Data Formats**: Support for additional file formats
- **Performance**: Improved handling of larger datasets
- **User Experience**: Enhanced interface and workflows

### Research Applications
- **Preclinical Studies**: Drug efficacy evaluation
- **Comparative Analysis**: Treatment comparison studies
- **Longitudinal Analysis**: Time-course studies
- **Publication Support**: Research paper figure generation

## Support

For technical support or scientific questions:
- **Documentation**: Refer to this README and inline help
- **Issues**: Use GitHub Issues for bug reports
- **Research Collaboration**: Contact for scientific partnerships

---

**ViVo Platform** - In ViVo Metrics

*Version 1.0 - Production Release*
