import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import LeaveOneOut
from sklearn.impute import SimpleImputer

def run_impella_analytics(file_path):
    # 1. Data Handling: Transpose because patients are in columns
    df = pd.read_excel(file_path, index_col=0)
    df_t = df.T # Technical Requirement: Always transpose
    
    # 2. Preprocessing: Qualitative Context scanner
    # keywords: ECMO, LVAD, Arrest, Transplant
    escalated_keywords = ['ECMO', 'LVAD', 'Arrest', 'Transplant']
    df_t['Escalated'] = df_t['General Notes'].fillna('').apply(
        lambda x: 1 if any(kw in str(x) for kw in escalated_keywords) else 0
    )
    
    # 3. Clinical Logic: Delta_CPO and Risk Indicators
    # Delta_CPO = Post minus Pre
    df_t['Delta_CPO'] = df_t['Post-Implant CPO'] - df_t['Baseline CPO']
    
    # Recovery Score: Normalized Delta_CPO (0-100)
    max_d = df_t['Delta_CPO'].max()
    min_d = df_t['Delta_CPO'].min()
    df_t['Recovery_Score'] = ((df_t['Delta_CPO'] - min_d) / (max_d - min_d)) * 100
    
    # Risk Indicators: RA > 20 and PAPI < 1.0
    df_t['High_Risk'] = ((df_t['Post RA'] > 20) | (df_t['Post PAPI'] < 1.0)).astype(int)
    
    # 4. Modeling: LOOCV with RandomForest
    features = ['Baseline RA', 'Baseline PCWP', 'Baseline CPO', 'Baseline PAPI', 'Escalated']
    X = df_t[features]
    y = df_t['Survived'] # Binary target
    
    # Preprocessing version 1: Mean Imputation
    imputer = SimpleImputer(strategy='mean')
    X_imputed = imputer.fit_transform(X)
    
    loo = LeaveOneOut()
    predictions = []
    
    for train_index, test_index in loo.split(X_imputed):
        X_train, X_test = X_imputed[train_index], X_imputed[test_index]
        y_train, y_test = y.iloc[train_index], y.iloc[test_index]
        
        rf = RandomForestRegressor(n_estimators=100, random_state=42)
        rf.fit(X_train, y_train)
        predictions.append(rf.predict(X_test)[0])
        
    df_t['Survivability_Prob'] = predictions
    return df_t

if __name__ == "__main__":
    # Example usage:
    # results = run_impella_analytics('clinical_data.xlsx')
    # print(results[['Delta_CPO', 'Recovery_Score', 'Survivability_Prob']])
    pass
