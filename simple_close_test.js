// Prosty test API zamykania miesiąca z debugowaniem
async function simpleCloseTest() {
    const fetch = (await import('node-fetch')).default;
    
    try {
        console.log('=== PROSTY TEST ZAMYKANIA MIESIĄCA ===\n');
        
        console.log('Wysyłanie żądania zamknięcia miesiąca 2025-06...');
        const response = await fetch('http://localhost:3001/api/months/2025-06/close', {
            method: 'POST'
        });
        
        console.log('Status odpowiedzi:', response.status);
        console.log('Status text:', response.statusText);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Odpowiedź:', data);
        } else {
            const errorText = await response.text();
            console.log('Błąd:', errorText);
        }
        
    } catch (error) {
        console.error('Błąd podczas testu:', error);
    }
}

simpleCloseTest();
