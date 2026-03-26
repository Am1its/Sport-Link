require('dotenv').config();
const express = require('express');
const cors = require('cors');


const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// נתיב בדיקה - לוודא שהשרת חי
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'SportLink API is running!' });
});

// הנתיב המרכזי של ה-PoC: משיכת מגרשים (Mock Data)
app.get('/api/courts/nearby', (req, res) => {
    console.log("📥 Received request for nearby courts...");
    
    // נתוני דמה שמחקים במדויק את התשובה של Google Places API
    const mockCourts = [
        {
            place_id: "mock_sportek_01",
            name: "ספורטק תל אביב - מגרשי כדורסל",
            sport_type: "basketball", // סוג ספורט
            geometry: { location: { lat: 32.09668, lng: 34.78685 } },
            vicinity: "שדרות רוקח, תל אביב-יפו",
            rating: 4.6
        },
        {
            place_id: "mock_charles_02",
            name: "פארק צ'ארלס קלור - מתחם כושר",
            sport_type: "tennis", // סוג ספורט
            geometry: { location: { lat: 32.06450, lng: 34.76120 } },
            vicinity: "פרופ' יחזקאל קויפמן, תל אביב-יפו",
            rating: 4.8
        },
        {
            place_id: "mock_gordon_03",
            name: "מגרשי כדורעף חופים - חוף גורדון",
            sport_type: "volleyball", // סוג ספורט
            geometry: { location: { lat: 32.08370, lng: 34.76810 } },
            vicinity: "חוף גורדון, תל אביב-יפו",
            rating: 4.7
        }
    ];

    // מחזירים את התשובה ללקוח (האפליקציה)
    res.json({
        success: true,
        source: "Mock Data (PoC)",
        total_results: mockCourts.length,
        courts: mockCourts
    });
});

// הפעלת השרת
app.listen(PORT, () => {
    console.log(`🚀 SportLink Backend is running on http://localhost:${PORT}`);
    console.log(`📍 Test the API: http://localhost:${PORT}/api/courts/nearby`);
});