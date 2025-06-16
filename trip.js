// Trip page functionality
let currentTrip = null;
let tripId = null;

// Get trip ID from URL
function getTripIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Load trip data
async function loadTrip() {
    tripId = getTripIdFromUrl();

    if (!tripId) {
        alert('ID поездки не найден');
        window.location.href = 'index.html';
        return;
    }

    try {
        currentTrip = await TravelSplitDB.loadTrip(tripId);

        if (!currentTrip) {
            alert('Поездка не найдена');
            window.location.href = 'index.html';
            return;
        }

        displayTripInfo();
        displayExpenses();
        displayBalances();
        populateParticipantSelects();
    } catch (error) {
        console.error('Error loading trip:', error);
        alert('Ошибка загрузки поездки');
    }
}

// Display trip information
function displayTripInfo() {
    document.getElementById('tripName').textContent = currentTrip.name;
    document.getElementById('participantsList').textContent = currentTrip.participants.join(', ');
}

// Populate participant select dropdowns
function populateParticipantSelects() {
    const paidBySelect = document.getElementById('paidBy');
    const participantsSelect = document.getElementById('expenseParticipants');

    // Clear existing options
    paidBySelect.innerHTML = '<option value="">Выберите плательщика</option>';
    participantsSelect.innerHTML = '';

    // Add participants to selects
    currentTrip.participants.forEach(participant => {
        // Paid by select
        const option1 = document.createElement('option');
        option1.value = participant;
        option1.textContent = participant;
        paidBySelect.appendChild(option1);

        // Participants checkboxes
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'checkbox-group';
        checkboxDiv.innerHTML = `
            <input type="checkbox" id="participant-${participant}" value="${participant}" checked>
            <label for="participant-${participant}">${participant}</label>
        `;
        participantsSelect.appendChild(checkboxDiv);
    });
}

// Handle expense form submission
document.addEventListener('DOMContentLoaded', () => {
    loadTrip();

    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const description = document.getElementById('description').value.trim();
        const amount = parseFloat(document.getElementById('amount').value);
        const paidBy = document.getElementById('paidBy').value;

        // Get selected participants
        const selectedParticipants = [];
        document.querySelectorAll('#expenseParticipants input[type="checkbox"]:checked').forEach(checkbox => {
            selectedParticipants.push(checkbox.value);
        });

        if (!description || !amount || !paidBy || selectedParticipants.length === 0) {
            alert('Пожалуйста, заполните все поля');
            return;
        }

        const newExpense = {
            id: TravelSplitDB.generateId(),
            description: description,
            amount: amount,
            paidBy: paidBy,
            participants: selectedParticipants,
            date: new Date().toISOString()
        };

        try {
            // Add expense to current trip
            if (!currentTrip.expenses) {
                currentTrip.expenses = [];
            }
            currentTrip.expenses.push(newExpense);
            currentTrip.lastModified = Date.now();

            // Save to Firebase
            await TravelSplitDB.saveTrip(currentTrip);

            // Clear form
            document.getElementById('expenseForm').reset();

            // Refresh displays
            displayExpenses();
            displayBalances();
            populateParticipantSelects();

            alert('Расход добавлен!');
        } catch (error) {
            console.error('Error adding expense:', error);
            alert('Ошибка добавления расхода');
        }
    });
});

// Display expenses
function displayExpenses() {
    const expensesList = document.getElementById('expensesList');

    if (!currentTrip.expenses || currentTrip.expenses.length === 0) {
        expensesList.innerHTML = '<p class="no-expenses">Пока нет добавленных расходов</p>';
        return;
    }

    expensesList.innerHTML = currentTrip.expenses.map(expense => `
        <div class="expense-item">
            <div class="expense-header">
                <h4>${expense.description}</h4>
                <span class="expense-amount">${expense.amount.toFixed(2)} ₽</span>
            </div>
            <div class="expense-details">
                <p><strong>Заплатил:</strong> ${expense.paidBy}</p>
                <p><strong>Участники:</strong> ${expense.participants.join(', ')}</p>
                <p><strong>Дата:</strong> ${new Date(expense.date).toLocaleDateString('ru-RU')}</p>
            </div>
            <button onclick="deleteExpense('${expense.id}')" class="btn btn-danger btn-small">Удалить</button>
        </div>
    `).join('');
}

// Delete expense
async function deleteExpense(expenseId) {
    if (!confirm('Удалить этот расход?')) {
        return;
    }

    try {
        currentTrip.expenses = currentTrip.expenses.filter(expense => expense.id !== expenseId);
        currentTrip.lastModified = Date.now();

        await TravelSplitDB.saveTrip(currentTrip);

        displayExpenses();
        displayBalances();

        alert('Расход удален');
    } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Ошибка удаления расхода');
    }
}

// Calculate and display balances
function displayBalances() {
    const balancesDiv = document.getElementById('balances');

    if (!currentTrip.expenses || currentTrip.expenses.length === 0) {
        balancesDiv.innerHTML = '<p class="no-balances">Добавьте расходы для расчета балансов</p>';
        return;
    }

    const balances = calculateBalances();
    const settlements = calculateSettlements(balances);

    let html = '<h3>💰 Баланс участников</h3>';
    html += '<div class="balances-grid">';

    Object.entries(balances).forEach(([person, balance]) => {
        const balanceClass = balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'zero';
        const balanceText = balance > 0 ? `+${balance.toFixed(2)} ₽` : `${balance.toFixed(2)} ₽`;

        html += `
            <div class="balance-item ${balanceClass}">
                <span class="person-name">${person}</span>
                <span class="balance-amount">${balanceText}</span>
            </div>
        `;
    });

    html += '</div>';

    if (settlements.length > 0) {
        html += '<h3>🔄 Кто кому должен</h3>';
        html += '<div class="settlements">';

        settlements.forEach(settlement => {
            html += `
                <div class="settlement-item">
                    <span class="debtor">${settlement.from}</span>
                    <span class="arrow">→</span>
                    <span class="creditor">${settlement.to}</span>
                    <span class="amount">${settlement.amount.toFixed(2)} ₽</span>
                </div>
            `;
        });

        html += '</div>';
    } else {
        html += '<p class="all-settled">✅ Все расчеты завершены!</p>';
    }

    balancesDiv.innerHTML = html;
}

// Calculate balances for each participant
function calculateBalances() {
    const balances = {};

    // Initialize balances
    currentTrip.participants.forEach(participant => {
        balances[participant] = 0;
    });

    // Calculate balances based on expenses
    currentTrip.expenses.forEach(expense => {
        const amountPerPerson = expense.amount / expense.participants.length;

        // Person who paid gets positive balance
        balances[expense.paidBy] += expense.amount;

        // Each participant gets negative balance for their share
        expense.participants.forEach(participant => {
            balances[participant] -= amountPerPerson;
        });
    });

    return balances;
}

// Calculate who owes whom
function calculateSettlements(balances) {
    const settlements = [];
    const debtors = [];
    const creditors = [];

    // Separate debtors and creditors
    Object.entries(balances).forEach(([person, balance]) => {
        if (balance < -0.01) { // Small threshold for floating point precision
            debtors.push({ person, amount: Math.abs(balance) });
        } else if (balance > 0.01) {
            creditors.push({ person, amount: balance });
        }
    });

    // Sort by amount (largest first)
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    // Calculate settlements
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];

        const settlementAmount = Math.min(debtor.amount, creditor.amount);

        settlements.push({
            from: debtor.person,
            to: creditor.person,
            amount: settlementAmount
        });

        debtor.amount -= settlementAmount;
        creditor.amount -= settlementAmount;

        if (debtor.amount < 0.01) i++;
        if (creditor.amount < 0.01) j++;
    }

    return settlements;
}

// Show all expenses modal
function showAllExpenses() {
    if (!currentTrip.expenses || currentTrip.expenses.length === 0) {
        alert('Нет расходов для отображения');
        return;
    }

    const modal = document.getElementById('allExpensesModal');
    const expensesList = document.getElementById('allExpensesList');

    // Calculate total
    const total = currentTrip.expenses.reduce((sum, expense) => sum + expense.amount, 0);

    let html = `<div class="expenses-summary">
        <h3>Все расходы поездки "${currentTrip.name}"</h3>
        <p><strong>Общая сумма: ${total.toFixed(2)} ₽</strong></p>
    </div>`;

    html += '<div class="expenses-list">';

    currentTrip.expenses
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach(expense => {
            html += `
                <div class="expense-item">
                    <div class="expense-header">
                        <h4>${expense.description}</h4>
                        <span class="expense-amount">${expense.amount.toFixed(2)} ₽</span>
                    </div>
                    <div class="expense-details">
                        <p><strong>Заплатил:</strong> ${expense.paidBy}</p>
                        <p><strong>Участники:</strong> ${expense.participants.join(', ')}</p>
                        <p><strong>Дата:</strong> ${new Date(expense.date).toLocaleDateString('ru-RU')}</p>
                    </div>
                </div>
            `;
        });

    html += '</div>';

    expensesList.innerHTML = html;
    modal.style.display = 'block';
}

// Close modal
function closeModal() {
    document.getElementById('allExpensesModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('allExpensesModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}