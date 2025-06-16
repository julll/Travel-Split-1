// Логика для страницы поездки TravelSplit

// Глобальные переменные
let currentTripId = null;
let currentTrip = null;
let balancesChart = null;

// Инициализация страницы поездки
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Запуск страницы поездки');

    // Получаем ID поездки из URL
    const urlParams = new URLSearchParams(window.location.search);
    currentTripId = parseInt(urlParams.get('id'));

    if (!currentTripId) {
        showNotification('Поездка не найдена', 'error');
        setTimeout(() => goBack(), 2000);
        return;
    }

    // Ждем инициализации базы данных
    if (window.db) {
        // Добавляем слушатель изменений
        window.db.addListener(loadTripData);

        // Загружаем данные поездки
        loadTripData();
    } else {
        console.error('❌ База данных не инициализирована');
    }

    // Настраиваем обработчики форм
    setupEventListeners();
});

// Настройка обработчиков событий
function setupEventListeners() {
    // Форма добавления участника
    const addParticipantForm = document.getElementById('add-participant-form');
    if (addParticipantForm) {
        addParticipantForm.addEventListener('submit', handleAddParticipant);
    }

    // Форма добавления расхода
    const addExpenseForm = document.getElementById('add-expense-form');
    if (addExpenseForm) {
        addExpenseForm.addEventListener('submit', handleAddExpense);
    }

    // Форма перевода
    const transferForm = document.getElementById('transfer-form');
    if (transferForm) {
        transferForm.addEventListener('submit', handleTransfer);
    }

    // Переключение типа разделения расхода
    const splitTypeRadios = document.querySelectorAll('input[name="split-type"]');
    splitTypeRadios.forEach(radio => {
        radio.addEventListener('change', handleSplitTypeChange);
    });

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

// Загрузка данных поездки
function loadTripData() {
    if (!window.db || !currentTripId) return;

    currentTrip = window.db.getTripById(currentTripId);

    if (!currentTrip) {
        showNotification('Поездка не найдена', 'error');
        setTimeout(() => goBack(), 2000);
        return;
    }

    renderTripHeader();
    renderBalances();
    renderRecentExpenses();
    renderDebtMatrix();
    updateParticipantSelects();
}

// Отображение заголовка поездки
function renderTripHeader() {
    if (!currentTrip) return;

    document.getElementById('trip-name').textContent = currentTrip.name;

    const locationElement = document.getElementById('trip-location');
    if (currentTrip.location) {
        locationElement.textContent = currentTrip.location;
        locationElement.style.display = 'inline';
    } else {
        locationElement.style.display = 'none';
    }

    const datesElement = document.getElementById('trip-dates');
    if (currentTrip.startDate && currentTrip.endDate) {
        const startDate = new Date(currentTrip.startDate).toLocaleDateString('ru-RU');
        const endDate = new Date(currentTrip.endDate).toLocaleDateString('ru-RU');
        datesElement.textContent = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
        datesElement.style.display = 'inline';
    } else if (currentTrip.startDate) {
        datesElement.textContent = new Date(currentTrip.startDate).toLocaleDateString('ru-RU');
        datesElement.style.display = 'inline';
    } else {
        datesElement.style.display = 'none';
    }

    // Обновляем заголовок страницы
    document.title = `${currentTrip.name} - TravelSplit`;
}

// Отображение балансов
function renderBalances() {
    if (!currentTrip) return;

    const balancesList = document.getElementById('balances-list');
    const balances = window.db.calculateBalances(currentTripId);

    if (Object.keys(balances).length === 0) {
        balancesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>Добавьте участников, чтобы видеть балансы</p>
            </div>
        `;
        return;
    }

    // Сортируем участников по балансу (должники внизу)
    const sortedBalances = Object.entries(balances).sort(([,a], [,b]) => b - a);

    balancesList.innerHTML = sortedBalances.map(([participant, balance]) => {
        const isPositive = balance > 0.01;
        const isNegative = balance < -0.01;
        const isZero = Math.abs(balance) <= 0.01;

        return `
            <div class="balance-item ${isPositive ? 'positive' : isNegative ? 'negative' : 'zero'}">
                <div class="participant-info">
                    <span class="participant-name">${escapeHtml(participant)}</span>
                    <span class="balance-status">
                        ${isPositive ? 'Должны вернуть' : isNegative ? 'Должен' : 'Расчёт'}
                    </span>
                </div>
                <div class="balance-amount">
                    ${isZero ? '0' : formatCurrency(Math.abs(balance))} ₽
                </div>
            </div>
        `;
    }).join('');

    // Обновляем график
    renderBalancesChart(balances);
}

// Отображение графика балансов
function renderBalancesChart(balances) {
    const canvas = document.getElementById('balances-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Уничтожаем предыдущий график
    if (balancesChart) {
        balancesChart.destroy();
    }

    const participants = Object.keys(balances);
    const amounts = Object.values(balances);

    if (participants.length === 0) {
        canvas.style.display = 'none';
        return;
    }

    canvas.style.display = 'block';

    balancesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: participants,
            datasets: [{
                label: 'Баланс',
                data: amounts,
                backgroundColor: amounts.map(amount => 
                    amount > 0.01 ? '#48bb78' : amount < -0.01 ? '#f56565' : '#a0aec0'
                ),
                borderColor: amounts.map(amount => 
                    amount > 0.01 ? '#38a169' : amount < -0.01 ? '#e53e3e' : '#718096'
                ),
                borderWidth: 2,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value) + ' ₽';
                        }
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45
                    }
                }
            },
            elements: {
                bar: {
                    borderSkipped: false
                }
            }
        }
    });
}

// Отображение последних расходов
function renderRecentExpenses() {
    if (!currentTrip) return;

    const recentExpensesContainer = document.getElementById('recent-expenses');
    const expenses = currentTrip.expenses || [];

    if (expenses.length === 0) {
        recentExpensesContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <p>Пока нет расходов</p>
            </div>
        `;
        return;
    }

    // Показываем последние 5 расходов
    const recentExpenses = [...expenses]
        .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
        .slice(0, 5);

    recentExpensesContainer.innerHTML = recentExpenses.map(expense => `
        <div class="expense-item">
            <div class="expense-info">
                <div class="expense-description">${escapeHtml(expense.description)}</div>
                <div class="expense-meta">
                    <span class="expense-payer">Платил: ${escapeHtml(expense.payer)}</span>
                    <span class="expense-date">${new Date(expense.date).toLocaleDateString('ru-RU')}</span>
                </div>
            </div>
            <div class="expense-amount">${formatCurrency(expense.amount)} ₽</div>
            <button class="btn-icon btn-danger btn-sm" onclick="deleteExpense(${expense.id})" title="Удалить">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

// Отображение матрицы долгов
function renderDebtMatrix() {
    if (!currentTrip) return;

    const debtMatrixContainer = document.getElementById('debt-matrix');
    const debtMatrix = window.db.calculateDebtMatrix(currentTripId);

    const debts = [];
    Object.entries(debtMatrix).forEach(([debtor, creditors]) => {
        Object.entries(creditors).forEach(([creditor, amount]) => {
            if (amount > 0.01) {
                debts.push({ debtor, creditor, amount });
            }
        });
    });

    if (debts.length === 0) {
        debtMatrixContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-handshake"></i>
                <p>Все расчёты завершены!</p>
            </div>
        `;
        return;
    }

    debtMatrixContainer.innerHTML = debts.map(debt => `
        <div class="debt-item">
            <div class="debt-info">
                <span class="debtor">${escapeHtml(debt.debtor)}</span>
                <i class="fas fa-arrow-right"></i>
                <span class="creditor">${escapeHtml(debt.creditor)}</span>
            </div>
            <div class="debt-amount">${formatCurrency(debt.amount)} ₽</div>
            <button class="btn btn-sm btn-outline" onclick="quickTransfer('${debt.debtor}', '${debt.creditor}', ${debt.amount})">
                <i class="fas fa-check"></i> Перевести
            </button>
        </div>
    `).join('');
}

// Обновление списков участников в селектах
function updateParticipantSelects() {
    if (!currentTrip) return;

    const participants = currentTrip.participants || [];
    const selects = [
        'expense-payer',
        'transfer-from',
        'transfer-to'
    ];

    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Выберите участника</option>';

            participants.forEach(participant => {
                const option = document.createElement('option');
                option.value = participant;
                option.textContent = participant;
                select.appendChild(option);
            });

            // Восстанавливаем выбранное значение
            if (participants.includes(currentValue)) {
                select.value = currentValue;
            }
        }
    });
}

// Показать модальное окно добавления участника
function showAddParticipantModal() {
    const modal = document.getElementById('add-participant-modal');
    if (modal) {
        modal.style.display = 'block';

        // Фокус на поле имени
        const nameInput = document.getElementById('participant-name');
        if (nameInput) {
            setTimeout(() => nameInput.focus(), 100);
        }
    }
}

// Скрыть модальное окно добавления участника
function hideAddParticipantModal() {
    const modal = document.getElementById('add-participant-modal');
    if (modal) {
        modal.style.display = 'none';

        // Очищаем форму
        const form = document.getElementById('add-participant-form');
        if (form) {
            form.reset();
        }
    }
}

// Обработка добавления участника
async function handleAddParticipant(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const participantName = formData.get('name').trim();

    if (!participantName) {
        showNotification('Введите имя участника', 'error');
        return;
    }

    if (currentTrip.participants && currentTrip.participants.includes(participantName)) {
        showNotification('Участник с таким именем уже существует', 'error');
        return;
    }

    try {
        const success = await window.db.addParticipant(currentTripId, participantName);
        if (success) {
            hideAddParticipantModal();
            showNotification('Участник добавлен!', 'success');
            loadTripData();
        } else {
            showNotification('Ошибка добавления участника', 'error');
        }
    } catch (error) {
        console.error('Ошибка добавления участника:', error);
        showNotification('Ошибка добавления участника', 'error');
    }
}

// Показать модальное окно добавления расхода
function showAddExpenseModal() {
    if (!currentTrip.participants || currentTrip.participants.length === 0) {
        showNotification('Сначала добавьте участников', 'error');
        return;
    }

    const modal = document.getElementById('add-expense-modal');
    if (modal) {
        modal.style.display = 'block';

        // Устанавливаем сегодняшнюю дату
        const dateInput = document.getElementById('expense-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Сбрасываем тип разделения
        const equalSplitRadio = document.querySelector('input[name="split-type"][value="equal"]');
        if (equalSplitRadio) {
            equalSplitRadio.checked = true;
            handleSplitTypeChange();
        }

        // Фокус на поле плательщика
        const payerSelect = document.getElementById('expense-payer');
        if (payerSelect) {
            setTimeout(() => payerSelect.focus(), 100);
        }
    }
}

// Скрыть модальное окно добавления расхода
function hideAddExpenseModal() {
    const modal = document.getElementById('add-expense-modal');
    if (modal) {
        modal.style.display = 'none';

        // Очищаем форму
        const form = document.getElementById('add-expense-form');
        if (form) {
            form.reset();
        }

        // Скрываем кастомные поля
        const customSplits = document.getElementById('custom-splits');
        if (customSplits) {
            customSplits.style.display = 'none';
        }
    }
}

// Обработка изменения типа разделения
function handleSplitTypeChange() {
    const splitType = document.querySelector('input[name="split-type"]:checked').value;
    const customSplits = document.getElementById('custom-splits');

    if (splitType === 'custom') {
        customSplits.style.display = 'block';
        generateCustomSplitsFields();
    } else {
        customSplits.style.display = 'none';
    }
}

// Генерация полей для кастомного разделения
function generateCustomSplitsFields() {
    const container = document.getElementById('splits-container');
    const participants = currentTrip.participants || [];

    container.innerHTML = participants.map(participant => `
        <div class="split-field">
            <label>${escapeHtml(participant)}</label>
            <input type="number" 
                   name="split-${participant}" 
                   min="0" 
                   step="0.01" 
                   placeholder="0"
                   oninput="updateSplitsSummary()">
        </div>
    `).join('');

    updateSplitsSummary();
}

// Обновление суммы разделения
function updateSplitsSummary() {
    const amountInput = document.getElementById('expense-amount');
    const totalAmount = parseFloat(amountInput.value) || 0;

    const splitInputs = document.querySelectorAll('[name^="split-"]');
    let splitsTotal = 0;

    splitInputs.forEach(input => {
        splitsTotal += parseFloat(input.value) || 0;
    });

    document.getElementById('splits-total').textContent = formatCurrency(splitsTotal);
    document.getElementById('splits-remaining').textContent = formatCurrency(totalAmount - splitsTotal);

    // Подсвечиваем если суммы не сходятся
    const remaining = totalAmount - splitsTotal;
    const remainingElement = document.getElementById('splits-remaining');

    if (Math.abs(remaining) > 0.01) {
        remainingElement.style.color = '#e53e3e';
    } else {
        remainingElement.style.color = '#38a169';
    }
}

// Обработка добавления расхода
async function handleAddExpense(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const splitType = formData.get('split-type');
    const amount = parseFloat(formData.get('amount'));

    const expenseData = {
        payer: formData.get('payer'),
        amount: amount,
        description: formData.get('description').trim(),
        date: formData.get('date'),
        splits: []
    };

    // Валидация
    if (!expenseData.payer) {
        showNotification('Выберите плательщика', 'error');
        return;
    }

    if (!expenseData.amount || expenseData.amount <= 0) {
        showNotification('Введите корректную сумму', 'error');
        return;
    }

    if (!expenseData.description) {
        showNotification('Введите описание расхода', 'error');
        return;
    }

    // Формируем разделение
    if (splitType === 'equal') {
        const participants = currentTrip.participants || [];
        const splitAmount = amount / participants.length;

        expenseData.splits = participants.map(participant => ({
            participant,
            amount: splitAmount
        }));
    } else {
        // Кастомное разделение
        const participants = currentTrip.participants || [];
        let totalSplits = 0;

        expenseData.splits = participants.map(participant => {
            const splitAmount = parseFloat(formData.get(`split-${participant}`)) || 0;
            totalSplits += splitAmount;
            return {
                participant,
                amount: splitAmount
            };
        }).filter(split => split.amount > 0);

        // Проверяем что суммы сходятся
        if (Math.abs(totalSplits - amount) > 0.01) {
            showNotification('Сумма разделения не равна общей сумме расхода', 'error');
            return;
        }
    }

    try {
        const success = await window.db.addExpense(currentTripId, expenseData);
        if (success) {
            hideAddExpenseModal();
            showNotification('Расход добавлен!', 'success');
            loadTripData();
        } else {
            showNotification('Ошибка добавления расхода', 'error');
        }
    } catch (error) {
        console.error('Ошибка добавления расхода:', error);
        showNotification('Ошибка добавления расхода', 'error');
    }
}

// Показать модальное окно перевода
function showTransferModal() {
    if (!currentTrip.participants || currentTrip.participants.length < 2) {
        showNotification('Нужно минимум 2 участника для перевода', 'error');
        return;
    }

    const modal = document.getElementById('transfer-modal');
    if (modal) {
        modal.style.display = 'block';

        // Фокус на поле отправителя
        const fromSelect = document.getElementById('transfer-from');
        if (fromSelect) {
            setTimeout(() => fromSelect.focus(), 100);
        }
    }
}

// Скрыть модальное окно перевода
function hideTransferModal() {
    const modal = document.getElementById('transfer-modal');
    if (modal) {
        modal.style.display = 'none';

        // Очищаем форму
        const form = document.getElementById('transfer-form');
        if (form) {
            form.reset();
        }
    }
}

// Быстрый перевод из матрицы долгов
function quickTransfer(from, to, amount) {
    // Заполняем форму
    document.getElementById('transfer-from').value = from;
    document.getElementById('transfer-to').value = to;
    document.getElementById('transfer-amount').value = amount;

    // Показываем модальное окно
    showTransferModal();
}

// Обработка перевода
async function handleTransfer(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const transferData = {
        from: formData.get('from'),
        to: formData.get('to'),
        amount: parseFloat(formData.get('amount'))
    };

    // Валидация
    if (!transferData.from) {
        showNotification('Выберите отправителя', 'error');
        return;
    }

    if (!transferData.to) {
        showNotification('Выберите получателя', 'error');
        return;
    }

    if (transferData.from === transferData.to) {
        showNotification('Отправитель и получатель не могут быть одинаковыми', 'error');
        return;
    }

    if (!transferData.amount || transferData.amount <= 0) {
        showNotification('Введите корректную сумму', 'error');
        return;
    }

    try {
        const success = await window.db.addTransfer(currentTripId, transferData);
        if (success) {
            hideTransferModal();
            showNotification('Перевод записан!', 'success');
            loadTripData();
        } else {
            showNotification('Ошибка записи перевода', 'error');
        }
    } catch (error) {
        console.error('Ошибка записи перевода:', error);
        showNotification('Ошибка записи перевода', 'error');
    }
}

// Удаление расхода
async function deleteExpense(expenseId) {
    const confirmed = confirm('Вы уверены, что хотите удалить этот расход?');
    if (!confirmed) return;

    try {
        const success = await window.db.deleteExpense(currentTripId, expenseId);
        if (success) {
            showNotification('Расход удален', 'success');
            loadTripData();
        } else {
            showNotification('Ошибка удаления расхода', 'error');
        }
    } catch (error) {
        console.error('Ошибка удаления расхода:', error);
        showNotification('Ошибка удаления расхода', 'error');
    }
}

// Показать все расходы
function showAllExpenses() {
    if (!currentTrip || !currentTrip.expenses || currentTrip.expenses.length === 0) {
        showNotification('Нет расходов для отображения', 'info');
        return;
    }

    const modal = document.getElementById('all-expenses-modal');
    const expensesList = document.getElementById('all-expenses-list');

    if (!modal || !expensesList) return;

    // Сортируем расходы по дате (новые сверху)
    const sortedExpenses = [...currentTrip.expenses]
        .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    expensesList.innerHTML = sortedExpenses.map(expense => `
        <div class="expense-item-detailed">
            <div class="expense-header">
                <div class="expense-description">${escapeHtml(expense.description)}</div>
                <div class="expense-amount">${formatCurrency(expense.amount)} ₽</div>
            </div>
            <div class="expense-details">
                <div class="expense-meta">
                    <span><i class="fas fa-user"></i> Платил: ${escapeHtml(expense.payer)}</span>
                    <span><i class="fas fa-calendar"></i> ${new Date(expense.date).toLocaleDateString('ru-RU')}</span>
                </div>
                <div class="expense-splits">
                    <strong>Разделение:</strong>
                    ${expense.splits.map(split => 
                        `<span class="split-item">${escapeHtml(split.participant)}: ${formatCurrency(split.amount)} ₽</span>`
                    ).join('')}
                </div>
            </div>
            <button class="btn-icon btn-danger btn-sm" onclick="deleteExpense(${expense.id})" title="Удалить">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');

    modal.style.display = 'block';
}

// Скрыть модальное окно всех расходов
function hideAllExpensesModal() {
    const modal = document.getElementById('all-expenses-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Возврат на главную страницу
function goBack() {
    window.location.href = 'index.html';
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

// Обновление суммы при изменении поля суммы расхода
document.addEventListener('DOMContentLoaded', function() {
    const amountInput = document.getElementById('expense-amount');
    if (amountInput) {
        amountInput.addEventListener('input', updateSplitsSummary);
    }
});