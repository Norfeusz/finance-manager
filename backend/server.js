console.log('SERVER działa')

const express = require('express')
const cors = require('cors')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

// Import tras
const expenseRoutes = require('./routes/expenseRoutes')
const transactionRoutes = require('./routes/transactionRoutes')
const statisticsRoutes = require('./routes/statisticsRoutes')
const accountRoutes = require('./routes/accountRoutes')
const categoryRoutes = require('./routes/categoryRoutes')
const monthRoutes = require('./routes/monthRoutes')
const aiRoutes = require('./routes/aiRoutes')
const pool = require('./db/pool') // Import połączenia z bazą danych
const { createTables } = require('./scripts/createTables')

// Inicjalizacja aplikacji Express
const app = express()
const port = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Rejestracja tras
app.use('/api/expenses', expenseRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/statistics', statisticsRoutes)
app.use('/api/accounts', accountRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/months', monthRoutes)
app.use('/api/ai', aiRoutes)

// Inicjalizacja bazy danych i uruchomienie serwera
async function startServer() {
	try {
		const skipInit = process.argv.includes('--skip-init')

		if (!skipInit) {
			// 1. Utwórz tabele w bazie danych jeśli nie istnieją
			await createTables()
			// 2. Podstawowe dane już istnieją w bazie
			console.log('Inicjalizacja bazy danych pominięta (--skip-init)')
		}

		// 3. Uruchom serwer
		app.listen(port, () => {
			console.log(`🚀 Serwer nasłuchuje na porcie ${port}`)
		})
	} catch (error) {
		console.error('Błąd podczas uruchamiania serwera:', error)
		process.exit(1)
	}
}

startServer()
