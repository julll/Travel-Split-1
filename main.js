// Основная логика для главной страницы TravelSplit

// Глобальные переменные
let currentTrips = [];

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Запуск TravelSplit');

    // Ждем инициализации базы данных
    if (window.db) {
        // Добавляем слушатель изменений
        window.db.addListener(loadTrips);

        // Загружаем поездки
        loadTrips();
    } else {
        console.error('❌ База данных не инициализирована');
    }

    // Настраиваем обработчики форм
    setupEventListeners();
});

// Настройка обработчиков событий
function setupEventListeners() {
    // Форма создания поездки
    const createTripForm = document.getElementById('create-trip-form');
    if (createTripForm) {
        createTripForm.addEventListener('submit', handleCreateTrip);
    }

    // Форма редактирования поездки
    const editTripForm = document.getElementById('edit-trip-form');
    if (editTripForm) {
        editTripForm.addEventListener('submit', handleEditTrip);
    }

    // Файл импорта
    const importFile = document.getElementById('import-file');
    if (importFile) {
        importFile.addEventListener('change', handleImportFile);
    }

    // Закрытие модальных окон по клику вне их
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            hideAllModals();
        }
    });

    // Закрытие модальных окон по Escape
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            hideAllModals();
        }
    });
}

// Загрузка поездок
function loadTrips() {
    if (!window.db) return;

    currentTrips = window.db.getAllTrips();
    renderTrips();
}

// Отображение поездок
function renderTrips() {
    const tripsList = document.getElementById('trips-list');
    if (!tripsList) return;

    if (currentTrips.length === 0) {
        tripsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-suitcase-rolling"></i>
                <h3>Пока нет поездок</h3>
                <p>Создайте первую поездку, чтобы начать учёт расходов</p>
            </div>
        `;
        return;
    }

    // Сортируем поездки по дате создания (новые сверху)
    const sortedTrips = [...currentTrips].sort((a, b) => 
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    tripsList.innerHTML = sortedTrips.map(trip => createTripCard(trip)).join('');
}

// Создание карточки поездки
function createTripCard(trip) {
    const totalExpenses = trip.expenses ? trip.expenses.reduce((sum, expense) => sum + expense.amount, 0) : 0;
    const participantsCount = trip.participants ? trip.participants.length : 0;
    const expensesCount = trip.expenses ? trip.expenses.length : 0;

    // Форматирование дат
    let dateRange = '';
    if (trip.startDate && trip.endDate) {
        const startDate = new Date(trip.startDate).toLocaleDateString('ru-RU');
        const endDate = new Date(trip.endDate).toLocaleDateString('ru-RU');
        dateRange = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
    } else if (trip.startDate) {
        dateRange = new Date(trip.startDate).toLocaleDateString('ru-RU');
    }

    return `
        <div class="trip-card" onclick="openTrip(${trip.id})">
            <div class="trip-card-header">
                <h3 class="trip-name">${escapeHtml(trip.name)}</h3>
                <div class="trip-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); editTrip(${trip.id})" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-danger" onclick="event.stopPropagation(); deleteTrip(${trip.id})" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>

            <div class="trip-card-body">
                ${trip.location ? `
                    <div class="trip-location">
                        <i class="fas fa-map-marker-alt"></i>
                        ${escapeHtml(trip.location)}
                    </div>
                ` : ''}

                ${dateRange ? `
                    <div class="trip-dates">
                        <i class="fas fa-calendar"></i>
                        ${dateRange}
                    </div>
                ` : ''}

                <div class="trip-stats">
                    <div class="stat">
                        <i class="fas fa-users"></i>
                        <span>${participantsCount} участник${getPlural(participantsCount, '', 'а', 'ов')}</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-receipt"></i>
                        <span>${expensesCount} расход${getPlural(expensesCount, '', 'а', 'ов')}</span>
                    </div>
                    <div class="stat total-amount">
                        <i class="fas fa-ruble-sign"></i>
                        <span>${formatCurrency(totalExpenses)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Открытие поездки
function openTrip(tripId) {
    window.location.href = `trip.html?id=${tripId}`;
}

// Показать модальное окно создания поездки
function showCreateTripModal() {
    const modal = document.getElementById('create-trip-modal');
    if (modal) {
        modal.style.display = 'block';

        // Устанавливаем сегодняшнюю дату как дату начала
        const startDateInput = document.getElementById('trip-start-date');
        if (startDateInput) {
            startDateInput.value = new Date().toISOString().split('T')[0];
        }

        // Фокус на поле названия
        const nameInput = document.getElementById('trip-name');
        if (nameInput) {
            setTimeout(() => nameInput.focus(), 100);
        }
    }
}

// Скрыть модальное окно создания поездки
function hideCreateTripModal() {
    const modal = document.getElementById('create-trip-modal');
    if (modal) {
        modal.style.display = 'none';

        // Очищаем форму
        const form = document.getElementById('create-trip-form');
        if (form) {
            form.reset();
        }
    }
}

// Обработка создания поездки
async function handleCreateTrip(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const tripData = {
        name: formData.get('name').trim(),
        location: formData.get('location').trim(),
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate')
    };

    // Валидация
    if (!tripData.name) {
        showNotification('Введите название поездки', 'error');
        return;
    }

    // Проверяем даты
    if (tripData.startDate && tripData.endDate && tripData.startDate > tripData.endDate) {
        showNotification('Дата начала не может быть позже даты окончания', 'error');
        return;
    }

    try {
        const tripId = await window.db.createTrip(tripData);
        if (tripId) {
            hideCreateTripModal();
            showNotification('Поездка создана!', 'success');
            loadTrips();
        } else {
            showNotification('Ошибка создания поездки', 'error');
        }
    } catch (error) {
        console.error('Ошибка создания поездки:', error);
        showNotification('Ошибка создания поездки', 'error');
    }
}

// Редактирование поездки
function editTrip(tripId) {
    const trip = window.db.getTripById(tripId);
    if (!trip) return;

    // Заполняем форму
    document.getElementById('edit-trip-id').value = tripId;
    document.getElementById('edit-trip-name').value = trip.name || '';
    document.getElementById('edit-trip-location').value = trip.location || '';
    document.getElementById('edit-trip-start-date').value = trip.startDate || '';
    document.getElementById('edit-trip-end-date').value = trip.endDate || '';

    // Показываем модальное окно
    const modal = document.getElementById('edit-trip-modal');
    if (modal) {
        modal.style.display = 'block';

        // Фокус на поле названия
        const nameInput = document.getElementById('edit-trip-name');
        if (nameInput) {
            setTimeout(() => nameInput.focus(), 100);
        }
    }
}

// Скрыть модальное окно редактирования
function hideEditTripModal() {
    const modal = document.getElementById('edit-trip-modal');
    if (modal) {
        modal.style.display = 'none';

        // Очищаем форму
        const form = document.getElementById('edit-trip-form');
        if (form) {
            form.reset();
        }
    }
}

// Обработка редактирования поездки
async function handleEditTrip(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const tripId = parseInt(formData.get('id') || document.getElementById('edit-trip-id').value);
    const tripData = {
        name: formData.get('name').trim(),
        location: formData.get('location').trim(),
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate')
    };

    // Валидация
    if (!tripData.name) {
        showNotification('Введите название поездки', 'error');
        return;
    }

    // Проверяем даты
    if (tripData.startDate && tripData.endDate && tripData.startDate > tripData.endDate) {
        showNotification('Дата начала не может быть позже даты окончания', 'error');
        return;
    }

    try {
        const success = await window.db.updateTrip(tripId, tripData);
        if (success) {
            hideEditTripModal();
            showNotification('Поездка обновлена!', 'success');
            loadTrips();
        } else {
            showNotification('Ошибка обновления поездки', 'error');
        }
    } catch (error) {
        console.error('Ошибка обновления поездки:', error);
        showNotification('Ошибка обновления поездки', 'error');
    }
}

// Удаление поездки
async function deleteTrip(tripId) {
    const trip = window.db.getTripById(tripId);
    if (!trip) return;

    const confirmed = confirm(`Вы уверены, что хотите удалить поездку "${trip.name}"?\n\nВсе расходы и данные будут потеряны безвозвратно.`);
    if (!confirmed) return;

    try {
        const success = await window.db.deleteTrip(tripId);
        if (success) {
            showNotification('Поездка удалена', 'success');
            loadTrips();
        } else {
            showNotification('Ошибка удаления поездки', 'error');
        }
    } catch (error) {
        console.error('Ошибка удаления поездки:', error);
        showNotification('Ошибка удаления поездки', 'error');
    }
}

// Экспорт данных
function exportData() {
    try {
        const data = {
            trips: currentTrips,
            exportDate: new Date().toISOString(),
            version: '2.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `travelsplit-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
        showNotification('Данные экспортированы!', 'success');
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        showNotification('Ошибка экспорта данных', 'error');
    }
}

// Импорт данных
function importData() {
    const fileInput = document.getElementById('import-file');
    if (fileInput) {
        fileInput.click();
    }
}

// Обработка импорта файла
function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.trips || !Array.isArray(data.trips)) {
                throw new Error('Неверный формат файла');
            }

            const confirmed = confirm(`Импортировать ${data.trips.length} поездок?\n\nЭто добавит новые поездки к существующим.`);
            if (!confirmed) return;

            let importedCount = 0;
            for (const tripData of data.trips) {
                // Создаем новый ID для избежания конфликтов
                const newTripData = {
                    ...tripData,
                    id: undefined, // Будет создан новый ID
                    createdAt: new Date().toISOString()
                };

                const tripId = await window.db.createTrip(newTripData);
                if (tripId) {
                    importedCount++;
                }
            }

            showNotification(`Импортировано ${importedCount} поездок!`, 'success');
            loadTrips();

        } catch (error) {
            console.error('Ошибка импорта:', error);
            showNotification('Ошибка импорта данных', 'error');
        }
    };

    reader.readAsText(file);

    // Очищаем input для повторного использования
    event.target.value = '';
}

// Поделиться данными
function shareData() {
    try {
        const data = {
            trips: currentTrips,
            exportDate: new Date().toISOString(),
            version: '2.0'
        };

        const dataStr = JSON.stringify(data);
        const encodedData = btoa(encodeURIComponent(dataStr));
        const shareUrl = `${window.location.origin}${window.location.pathname}?import=${encodedData}`;

        if (navigator.share) {
            navigator.share({
                title: 'TravelSplit - Мои поездки',
                text: 'Данные о поездках из TravelSplit',
                url: shareUrl
            });
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                showNotification('Ссылка скопирована в буфер обмена!', 'success');
            });
        } else {
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Ссылка скопирована!', 'success');
        }
    } catch (error) {
        console.error('Ошибка создания ссылки:', error);
        showNotification('Ошибка создания ссылки', 'error');
    }
}

// Скрытие всех модальных окон
function hideAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// Показ уведомлений
function showNotification(message, type = 'info') {
    // Удаляем существующие уведомления
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        animation: slideInRight 0.3s ease;
        ${type === 'success' ? 'background: linear-gradient(135deg, #38a169, #48bb78);' : ''}
        ${type === 'error' ? 'background: linear-gradient(135deg, #e53e3e, #fc8181);' : ''}
        ${type === 'info' ? 'background: linear-gradient(135deg, #3182ce, #63b3ed);' : ''}
    `;

    document.body.appendChild(notification);

    // Автоматическое удаление через 4 секунды
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

// Вспомогательные функции

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Форматирование валюты
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

// Получение правильного окончания для числительных
function getPlural(number, one, two, five) {
    const n = Math.abs(number) % 100;
    const n1 = n % 10;

    if (n > 10 && n < 20) return five;
    if (n1 > 1 && n1 < 5) return two;
    if (n1 === 1) return one;
    return five;
}

// Проверка импорта из URL при загрузке
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const importData = urlParams.get('import');

    if (importData) {
        try {
            const dataStr = decodeURIComponent(atob(importData));
            const data = JSON.parse(dataStr);

            if (data.trips && Array.isArray(data.trips)) {
                const confirmed = confirm(`Импортировать ${data.trips.length} поездок из ссылки?`);
                if (confirmed) {
                    // Имитируем загрузку файла
                    const event = {
                        target: {
                            result: JSON.stringify(data)
                        }
                    };

                    // Используем существующую логику импорта
                    setTimeout(() => {
                        handleImportFile({ target: { files: [new Blob([JSON.stringify(data)], { type: 'application/json' })] } });
                    }, 1000);
                }
            }

            // Очищаем URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
            console.error('Ошибка импорта из URL:', error);
        }
    }
});