import pandas as pd
import json
import numpy as np

def generate_ai_studio_knowledge_base(file_path, output_name):
    # 1. Load and Transpose
    # Using 'openpyxl' which you just installed
    df_raw = pd.read_excel(file_path, sheet_name='Patient Data')
    df_raw.set_index(df_raw.columns[0], inplace=True)
    df = df_raw.T 
    
    # Replace NaN with None (which becomes 'null' in JSON)
    df = df.replace({np.nan: None})
    
    knowledge_base = []
    
    for patient_id, row in df.iterrows():
        # Helper to safely get a single value and avoid 'Series' errors
        def get_val(col_name):
            val = row.get(col_name)
            if isinstance(val, pd.Series):
                return val.iloc[0] # Take the first if multiple found
            return val

        patient_data = {
            "id": str(patient_id),
            "demographics": {
                "age": get_val('Age'),
                "scai": get_val('SCAI Stage\nat time of Impella')
            },
            "hemodynamics_pre": {
                "ra": get_val('RA Pressure (mmHg)'),
                "pcwp": get_val('PCWP (mmHg)'),
                "cpo": get_val('CPO'),
                "papi": get_val('PAPI')
            },
            "support_and_outcomes": {
                "vis_score": get_val('VIS Score'), 
                "ees_ea": get_val('Ees/Ea'),      
                "escalated": 1 if "ECMO" in str(get_val('General') or "") else 0,
                "weaned": 1 if "removed" in str(get_val('General') or "") else 0
            }
        }
        knowledge_base.append(patient_data)

    # 3. Save to JSON
    with open(output_name, 'w') as f:
        json.dump(knowledge_base, f, indent=4)
    
    print(f"Success! Knowledge base saved as {output_name}")

# Run the conversion
generate_ai_studio_knowledge_base('Impella JHH Patient List Final MK.xlsx', 'impella_knowledge_base.json')
