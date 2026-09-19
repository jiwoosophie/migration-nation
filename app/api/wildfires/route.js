import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Using a reliable public ArcGIS feature layer endpoint for active interagency fire perimeters
    const response = await fetch('https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson');
    
    if (!response.ok) {
      throw new Error('External API responded with status ' + response.status);
    }

    const data = await response.json();

    return NextResponse.json({ 
      success: true, 
      count: data.features ? data.features.length : 0, 
      fires: data.features || [] 
    });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}