// Система управления данными с использованием localStorage
class TravelSplitDB {
    constructor() {
        this.storageKey = 'travelsplit_data';
        this.initializeDB();
    }

    // Инициализация базы данных
    initializeDB() {
        if (!localStorage.getItem(this.storageKey)) {
            const initialData = {
                trips: [],
                nextTripId: 1
            };
            localStorage.setItem(this.storageKey, JSON.stringify(initialData));
        }
    }

    // Получение всех данных
    getData() {
        return JSON.parse(localStorage.getItem(this.storageKey));
    }

    // Сохранение данных
    saveData(data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    // Создание новой поездки
    createTrip(tripData) {
        const data = this.getData();
        const newTrip = {
            id: data.nextTripId++,
            name: tripData.name,
            location: tripData.location || '',
            startDate: tripData.startDate || null,
            endDate: tripData.endDate || null,
            participants: [],
            expenses: [],
            transfers: [],
            createdAt: new Date().toISOString()
        };

        data.trips.push(newTrip);
        this.saveData(data);
        return newTrip;
    }

    // Получение всех поездок
    getAllTrips() {
        return this.getData().trips;
    }

    // Получение поездки по ID
    getTripById(tripId) {
        const data = this.getData();
        return data.trips.find(trip => trip.id === parseInt(tripId));
    }

    // Обновление поездки
    updateTrip(tripId, updates) {
        const data = this.getData();
        const tripIndex = data.trips.findIndex(trip => trip.id === parseInt(tripId));

        if (tripIndex !== -1) {
            data.trips[tripIndex] = { ...data.trips[tripIndex], ...updates };
            this.saveData(data);
            return data.trips[tripIndex];
        }
        return null;
    }

    // Добавление участника
    addParticipant(tripId, participantName) {
        const trip = this.getTripById(tripId);
        if (trip && !trip.participants.includes(participantName.trim())) {
            trip.participants.push(participantName.trim());
            this.updateTrip(tripId, trip);
            return true;
        }
        return false;
    }

    // Удаление участника
    removeParticipant(tripId, participantName) {
        const trip = this.getTripById(tripId);
        if (trip) {
            trip.participants = trip.participants.filter(p => p !== participantName);
            // Также удаляем все расходы и переводы этого участника
            trip.expenses = trip.expenses.filter(e => 
                e.payer !== participantName && 
                !e.splits.some(s => s.participant === participantName)
            );
            trip.transfers = trip.transfers.filter(t => 
                t.from !== participantName && t.to !== participantName
            );
            this.updateTrip(tripId, trip);
            return true;
        }
        return false;
    }

    // Добавление расхода
    addExpense(tripId, expenseData) {
        const trip = this.getTripById(tripId);
        if (trip) {
            const newExpense = {
                id: Date.now(),
                payer: expenseData.payer,
                amount: parseFloat(expenseData.amount),
                description: expenseData.description,
                date: expenseData.date || new Date().toISOString().split('T')[0],
                splits: expenseData.splits || [],
                createdAt: new Date().toISOString()
            };

            trip.expenses.push(newExpense);

            // Автоматическое обновление дат поездки
            this.updateTripDates(trip);

            this.updateTrip(tripId, trip);
            return newExpense;
        }
        return null;
    }

    // Добавление перевода
    addTransfer(tripId, transferData) {
        const trip = this.getTripById(tripId);
        if (trip) {
            const newTransfer = {
                id: Date.now(),
                from: transferData.from,
                to: transferData.to,
                amount: parseFloat(transferData.amount),
                date: transferData.date || new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString()
            };

            trip.transfers.push(newTransfer);
            this.updateTrip(tripId, trip);
            return newTransfer;
        }
        return null;
    }

    // Автоматическое обновление дат поездки на основе расходов
    updateTripDates(trip) {
        if (trip.expenses.length > 0) {
            const dates = trip.expenses.map(e => e.date).filter(d => d);
            if (dates.length > 0) {
                const minDate = dates.reduce((min, date) => date < min ? date : min);
                const maxDate = dates.reduce((max, date) => date > max ? date : max);

                if (!trip.startDate) trip.startDate = minDate;
                if (!trip.endDate) trip.endDate = maxDate;
            }
        }
    }

    // Расчет балансов участников
    calculateBalances(tripId) {
        const trip = this.getTripById(tripId);
        if (!trip) return {};

        const balances = {};

        // Инициализация балансов
        trip.participants.forEach(participant => {
            balances[participant] = 0;
        });

        // Обработка расходов
        trip.expenses.forEach(expense => {
            // Плательщик получает всю сумму
            if (balances.hasOwnProperty(expense.payer)) {
                balances[expense.payer] += expense.amount;
            }

            // Вычитаем доли участников
            expense.splits.forEach(split => {
                if (balances.hasOwnProperty(split.participant)) {
                    balances[split.participant] -= split.amount;
                }
            });
        });

        // Обработка переводов
        trip.transfers.forEach(transfer => {
            if (balances.hasOwnProperty(transfer.from)) {
                balances[transfer.from] -= transfer.amount;
            }
            if (balances.hasOwnProperty(transfer.to)) {
                balances[transfer.to] += transfer.amount;
            }
        });

        return balances;
    }

    // Расчет матрицы долгов между участниками
    calculateDebtMatrix(tripId) {
        const trip = this.getTripById(tripId);
        if (!trip) return {};

        const matrix = {};

        // Инициализация матрицы
        trip.participants.forEach(from => {
            matrix[from] = {};
            trip.participants.forEach(to => {
                if (from !== to) {
                    matrix[from][to] = 0;
                }
            });
        });

        // Обработка расходов
        trip.expenses.forEach(expense => {
            expense.splits.forEach(split => {
                if (split.participant !== expense.payer && 
                    matrix[split.participant] && 
                    matrix[split.participant][expense.payer] !== undefined) {
                    matrix[split.participant][expense.payer] += split.amount;
                }
            });
        });

        // Вычитаем переводы
        trip.transfers.forEach(transfer => {
            if (matrix[transfer.from] && matrix[transfer.from][transfer.to] !== undefined) {
                matrix[transfer.from][transfer.to] -= transfer.amount;
                // Если долг стал отрицательным, переносим его в обратную сторону
                if (matrix[transfer.from][transfer.to] < 0) {
                    const debt = Math.abs(matrix[transfer.from][transfer.to]);
                    matrix[transfer.from][transfer.to] = 0;
                    if (matrix[transfer.to] && matrix[transfer.to][transfer.from] !== undefined) {
                        matrix[transfer.to][transfer.from] += debt;
                    }
                }
            }
        });

        return matrix;
    }

    // Получение статистики поездки
    getTripStats(tripId) {
        const trip = this.getTripById(tripId);
        if (!trip) return null;

        const totalExpenses = trip.expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const totalTransfers = trip.transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
        const participantCount = trip.participants.length;

        return {
            totalExpenses,
            totalTransfers,
            participantCount,
            averagePerPerson: participantCount > 0 ? totalExpenses / participantCount : 0
        };
    }

    // Удаление поездки
    deleteTrip(tripId) {
        const data = this.getData();
        data.trips = data.trips.filter(trip => trip.id !== parseInt(tripId));
        this.saveData(data);
        return true;
    }

    // Удаление расхода
    deleteExpense(tripId, expenseId) {
        const trip = this.getTripById(tripId);
        if (trip) {
            trip.expenses = trip.expenses.filter(expense => expense.id !== expenseId);
            this.updateTrip(tripId, trip);
            return true;
        }
        return false;
    }

    // Удаление перевода
    deleteTransfer(tripId, transferId) {
        const trip = this.getTripById(tripId);
        if (trip) {
            trip.transfers = trip.transfers.filter(transfer => transfer.id !== transferId);
            this.updateTrip(tripId, trip);
            return true;
        }
        return false;
    }
}

// Создаем глобальный экземпляр базы данных
window.db = new TravelSplitDB();


// Функции экспорта и импорта данных
const DataManager = {
    // Экспорт всех данных в JSON файл
    exportData() {
        try {
            const allData = {
                trips: this.getAllTrips(),
                exportDate: new Date().toISOString(),
                version: '1.0'
            };

            const dataStr = JSON.stringify(allData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `travelsplit-backup-${new Date().toISOString().split('T')[0]}.json`;
            link.click();

            return true;
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            return false;
        }
    },

    // Импорт данных из JSON файла
    importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);

                    // Валидация данных
                    if (!importedData.trips || !Array.isArray(importedData.trips)) {
                        throw new Error('Неверный формат файла');
                    }

                    // Подтверждение перезаписи
                    const existingTrips = this.getAllTrips();
                    if (existingTrips.length > 0) {
                        const confirmMessage = `У вас уже есть ${existingTrips.length} поездок. Импорт заменит все существующие данные. Продолжить?`;
                        if (!confirm(confirmMessage)) {
                            resolve({ success: false, message: 'Импорт отменен' });
                            return;
                        }
                    }

                    // Очистка существующих данных
                    localStorage.removeItem('travelsplit_trips');
                    localStorage.removeItem('travelsplit_nextId');

                    // Импорт новых данных
                    localStorage.setItem('travelsplit_trips', JSON.stringify(importedData.trips));

                    // Обновление счетчика ID
                    let maxId = 0;
                    importedData.trips.forEach(trip => {
                        if (trip.id > maxId) maxId = trip.id;
                        trip.expenses.forEach(expense => {
                            if (expense.id > maxId) maxId = expense.id;
                        });
                    });
                    localStorage.setItem('travelsplit_nextId', (maxId + 1).toString());

                    resolve({ 
                        success: true, 
                        message: `Успешно импортировано ${importedData.trips.length} поездок`,
                        tripsCount: importedData.trips.length
                    });

                } catch (error) {
                    reject({ success: false, message: 'Ошибка при импорте: ' + error.message });
                }
            };

            reader.onerror = () => {
                reject({ success: false, message: 'Ошибка чтения файла' });
            };

            reader.readAsText(file);
        });
    },

    // Получение всех поездок для экспорта
    getAllTrips() {
        const trips = localStorage.getItem('travelsplit_trips');
        return trips ? JSON.parse(trips) : [];
    },

    // Создание резервной копии в облачном хранилище (через ссылку)
    generateShareableLink() {
        try {
            const allData = {
                trips: this.getAllTrips(),
                exportDate: new Date().toISOString()
            };

            const dataStr = JSON.stringify(allData);
            const encodedData = btoa(unescape(encodeURIComponent(dataStr)));

            // Создаем ссылку с данными
            const baseUrl = window.location.origin + window.location.pathname;
            const shareUrl = `${baseUrl}?import=${encodedData}`;

            return shareUrl;
        } catch (error) {
            console.error('Ошибка создания ссылки:', error);
            return null;
        }
    },

    // Импорт данных из URL
    importFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const importData = urlParams.get('import');

        if (importData) {
            try {
                const decodedData = decodeURIComponent(escape(atob(importData)));
                const parsedData = JSON.parse(decodedData);

                if (parsedData.trips && parsedData.trips.length > 0) {
                    const confirmMessage = `Найдены данные для импорта (${parsedData.trips.length} поездок). Импортировать?`;
                    if (confirm(confirmMessage)) {
                        // Очистка URL
                        window.history.replaceState({}, document.title, window.location.pathname);

                        // Импорт данных
                        localStorage.setItem('travelsplit_trips', JSON.stringify(parsedData.trips));

                        // Обновление счетчика ID
                        let maxId = 0;
                        parsedData.trips.forEach(trip => {
                            if (trip.id > maxId) maxId = trip.id;
                            trip.expenses.forEach(expense => {
                                if (expense.id > maxId) maxId = expense.id;
                            });
                        });
                        localStorage.setItem('travelsplit_nextId', (maxId + 1).toString());

                        return { success: true, tripsCount: parsedData.trips.length };
                    }
                }
            } catch (error) {
                console.error('Ошибка импорта из URL:', error);
            }
        }

        return { success: false };
    }
};

// Добавляем DataManager к объекту db
Object.assign(db, DataManager);