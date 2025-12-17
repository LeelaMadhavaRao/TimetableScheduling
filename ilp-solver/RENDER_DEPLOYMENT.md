# ILP Timetable Solver on Render

This Python FastAPI application solves the classroom/lab timetable scheduling problem using Google OR-Tools CP-SAT solver.

## Local Development

```bash
pip install -r requirements.txt
python app.py
```

Server runs on http://localhost:8000

## API Endpoint

**POST** `/solve-labs`

Request body:
```json
{
  "courses": [
    {
      "courseIndex": 0,
      "subjectCode": "CS-101L",
      "sectionName": "CSE-1A",
      "facultyCode": "CSE-F001",
      "facultyId": "uuid",
      "studentCount": 48,
      "yearLevel": 1
    }
  ],
  "rooms": [
    {
      "roomIndex": 0,
      "name": "LAB-01",
      "capacity": 50,
      "roomType": "lab"
    }
  ],
  "rules": {
    "periodsPerDay": 8,
    "labBlockSize": 4,
    "minCapacityPercent": 85
  }
}
```

Response:
```json
{
  "success": true,
  "assignments": [
    {
      "courseIndex": 0,
      "roomIndex": 0,
      "day": 0,
      "block": "1-4"
    }
  ],
  "solvetime_ms": 450
}
```

## Deployment on Render

1. Connect GitHub repository
2. Create new Web Service
3. Runtime: Python 3.11
4. Build command: `bash build.sh`
5. Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
6. Set environment variables (if needed)
