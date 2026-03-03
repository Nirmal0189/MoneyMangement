/* ========================================
   MoneyWise — Application Logic
   ======================================== */

; (function () {
    'use strict';

    // ── Constants ──
    const STORAGE_KEY = 'moneywise_transactions';
    const BALANCE_KEY = 'moneywise_total_balance';
    const CATEGORIES = [
        'Salary', 'Freelance', 'Investment', 'Business', 'Other Income',
        'Food & Dining', 'Rent', 'Utilities', 'Transport', 'Shopping',
        'Entertainment', 'Health', 'Education', 'EMI & Loans', 'Insurance', 'Other Expense'
    ];

    const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // ── DOM References ──
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const sidebar = $('#sidebar');
    const hamburger = $('#hamburger');
    const overlay = $('#sidebarOverlay');
    const navLinks = $$('.nav-link');
    const views = $$('.view');

    // Dashboard
    const dashboardMonth = $('#dashboardMonth');
    const cardBalance = $('#cardBalance');
    const cardIncome = $('#cardIncome');
    const cardExpense = $('#cardExpense');
    const cardCount = $('#cardCount');
    const recentTableBody = $('#recentTableBody');
    const dashboardEmpty = $('#dashboardEmpty');

    // Transactions
    const filterMonth = $('#filterMonth');
    const filterType = $('#filterType');
    const filterCategory = $('#filterCategory');
    const filterSearch = $('#filterSearch');
    const transactionBody = $('#transactionTableBody');
    const transactionEmpty = $('#transactionEmpty');
    const addTransactionBtn = $('#addTransactionBtn');

    // Reports
    const reportMonth = $('#reportMonth');
    const reportCreditsVal = $('#reportCredits');
    const reportDebitsVal = $('#reportDebits');
    const reportBalanceVal = $('#reportBalance');
    const reportCreditsBody = $('#reportCreditsBody');
    const reportCreditsFoot = $('#reportCreditsFoot');
    const reportDebitsBody = $('#reportDebitsBody');
    const reportDebitsFoot = $('#reportDebitsFoot');
    const reportEmpty = $('#reportEmpty');
    const downloadPdfBtn = $('#downloadPdfBtn');

    // Modal
    const modalOverlay = $('#modalOverlay');
    const modalTitle = $('#modalTitle');
    const modalClose = $('#modalClose');
    const modalCancelBtn = $('#modalCancelBtn');
    const modalSaveBtn = $('#modalSaveBtn');
    const txForm = $('#transactionForm');
    const txId = $('#txId');
    const txAmount = $('#txAmount');
    const txDate = $('#txDate');
    const txCategory = $('#txCategory');
    const txDescription = $('#txDescription');
    const typeCreditBtn = $('#typeCreditBtn');
    const typeDebitBtn = $('#typeDebitBtn');

    // Delete
    const deleteOverlay = $('#deleteOverlay');
    const deleteClose = $('#deleteClose');
    const deleteCancelBtn = $('#deleteCancelBtn');
    const deleteConfirmBtn = $('#deleteConfirmBtn');

    const toastContainer = $('#toastContainer');

    // ── State ──
    let transactions = [];
    let currentType = 'credit';
    let deleteTargetId = null;
    let totalBalance = 0;

    // ── Helpers ──
    function uuid() {
        return 'xxxx-xxxx-xxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
    }

    function formatCurrency(n) {
        return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatPDFCurrency(n) {
        // Use 'Rs.' for PDF to avoid encoding issues with the Rupee symbol
        return 'Rs. ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function currentMonthStr() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    function monthLabel(ymStr) {
        const [y, m] = ymStr.split('-');
        return MONTH_NAMES[parseInt(m, 10) - 1] + ' ' + y;
    }

    function toast(msg, type = 'success') {
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.textContent = msg;
        toastContainer.appendChild(el);
        setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 320); }, 3000);
    }

    // ── Data Layer ──
    function load() {
        try {
            transactions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch { transactions = []; }
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    }

    function addTransaction(tx) {
        transactions.push(tx);
        save();
    }

    function updateTransaction(id, data) {
        const idx = transactions.findIndex(t => t.id === id);
        if (idx !== -1) { Object.assign(transactions[idx], data); save(); }
    }

    function deleteTransaction(id) {
        transactions = transactions.filter(t => t.id !== id);
        save();
    }

    function getByMonth(ym) {
        return transactions.filter(t => t.date.startsWith(ym));
    }

    // ── Total Balance ──
    function loadBalance() {
        try {
            totalBalance = parseFloat(localStorage.getItem(BALANCE_KEY)) || 0;
        } catch { totalBalance = 0; }
    }

    function saveBalance() {
        localStorage.setItem(BALANCE_KEY, totalBalance.toString());
    }

    function adjustBalance(type, amount) {
        if (type === 'credit') totalBalance += amount;
        else totalBalance -= amount;
        saveBalance();
    }

    function reverseBalance(type, amount) {
        // Reverse a previously applied transaction
        if (type === 'credit') totalBalance -= amount;
        else totalBalance += amount;
        saveBalance();
    }

    function resetBalance() {
        if (confirm('Are you sure you want to reset the total balance to ₹0.00? This cannot be undone.')) {
            const amountToClear = totalBalance;
            totalBalance = 0;
            saveBalance();

            // Log the reset as a transaction for traceability
            addTransaction({
                id: uuid(),
                type: amountToClear >= 0 ? 'debit' : 'credit',
                amount: Math.abs(amountToClear),
                date: new Date().toISOString().split('T')[0],
                category: 'Balance Reset',
                description: 'Total balance reset to zero'
            });

            renderTotalBalance();
            toast('Total balance has been reset to zero.', 'info');
            refreshCurrentView();
        }
    }



    function renderTotalBalance() {
        const el = $('#totalBalanceValue');
        if (el) {
            el.textContent = formatCurrency(totalBalance);
            // Update gradient color based on positive/negative
            if (totalBalance < 0) {
                el.style.background = 'linear-gradient(135deg, var(--red), #f87171)';
                el.style.webkitBackgroundClip = 'text';
                el.style.backgroundClip = 'text';
            } else {
                el.style.background = 'linear-gradient(135deg, var(--text-primary), var(--accent-hover))';
                el.style.webkitBackgroundClip = 'text';
                el.style.backgroundClip = 'text';
            }
        }
    }

    // ── Navigation ──
    function navigate(view) {
        views.forEach(v => v.classList.remove('active'));
        navLinks.forEach(l => l.classList.remove('active'));

        const target = $(`#view-${view}`);
        const link = $(`[data-view="${view}"]`);
        if (target) target.classList.add('active');
        if (link) link.classList.add('active');

        // Close mobile sidebar
        sidebar.classList.remove('open');
        hamburger.classList.remove('open');
        overlay.classList.remove('show');

        if (view === 'dashboard') renderDashboard();
        else if (view === 'transactions') renderTransactions();
        else if (view === 'reports') renderReports();
    }

    function initRouter() {
        const hash = (location.hash || '#dashboard').replace('#', '');
        navigate(hash);
    }

    // ── Dashboard ──
    function renderDashboard() {
        const ym = dashboardMonth.value;
        const list = getByMonth(ym);

        // Filter out system adjustments for income/expense cards
        const filteredForTotals = list.filter(t =>
            t.category !== 'Balance Added' &&
            t.category !== 'Balance Removed' &&
            t.category !== 'Balance Reset'
        );

        let income = 0, expense = 0;
        filteredForTotals.forEach(t => { if (t.type === 'credit') income += t.amount; else expense += t.amount; });

        cardIncome.textContent = formatCurrency(income);
        cardExpense.textContent = formatCurrency(expense);
        cardBalance.textContent = formatCurrency(income - expense);
        cardCount.textContent = list.length; // Count total transactions including system ones

        // Color balance
        const bal = income - expense;
        cardBalance.style.color = bal >= 0 ? 'var(--blue)' : 'var(--red)';

        // Update total balance display
        renderTotalBalance();

        // Recent (up to 8)
        const recent = [...list].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
        recentTableBody.innerHTML = '';

        if (recent.length === 0) {
            dashboardEmpty.classList.remove('hidden');
            $('#recentTable').style.display = 'none';
        } else {
            dashboardEmpty.classList.add('hidden');
            $('#recentTable').style.display = '';
            recent.forEach(t => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
          <td>${formatDate(t.date)}</td>
          <td>${escapeHtml(t.description)}</td>
          <td>${escapeHtml(t.category)}</td>
          <td><span class="badge badge-${t.type}">${t.type === 'credit' ? '↑ Credit' : '↓ Debit'}</span></td>
          <td class="text-right"><span class="amount-${t.type}">${t.type === 'credit' ? '+' : '-'}${formatCurrency(t.amount)}</span></td>
        `;
                recentTableBody.appendChild(tr);
            });
        }
    }

    // ── Transactions ──
    function populateCategoryFilter() {
        const used = new Set(transactions.map(t => t.category));
        filterCategory.innerHTML = '<option value="all">All Categories</option>';
        CATEGORIES.filter(c => used.has(c)).forEach(c => {
            filterCategory.innerHTML += `<option value="${c}">${c}</option>`;
        });
    }

    function renderTransactions() {
        populateCategoryFilter();

        const ym = filterMonth.value;
        const type = filterType.value;
        const cat = filterCategory.value;
        const search = filterSearch.value.toLowerCase().trim();

        let list = getByMonth(ym); // Show ALL transactions including system ones
        if (type !== 'all') list = list.filter(t => t.type === type);
        if (cat !== 'all') list = list.filter(t => t.category === cat);
        if (search) list = list.filter(t => t.description.toLowerCase().includes(search));

        list.sort((a, b) => b.date.localeCompare(a.date));

        transactionBody.innerHTML = '';

        if (list.length === 0) {
            transactionEmpty.classList.remove('hidden');
            $('#transactionTable').style.display = 'none';
        } else {
            transactionEmpty.classList.add('hidden');
            $('#transactionTable').style.display = '';
            list.forEach(t => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
          <td>${formatDate(t.date)}</td>
          <td>${escapeHtml(t.description)}</td>
          <td>${escapeHtml(t.category)}</td>
          <td><span class="badge badge-${t.type}">${t.type === 'credit' ? '↑ Credit' : '↓ Debit'}</span></td>
          <td class="text-right"><span class="amount-${t.type}">${t.type === 'credit' ? '+' : '-'}${formatCurrency(t.amount)}</span></td>
          <td class="text-center">
            <div class="action-buttons">
              <button class="btn-icon btn-icon-edit" data-edit="${t.id}" title="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="btn-icon btn-icon-delete" data-delete="${t.id}" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        `;
                transactionBody.appendChild(tr);
            });
        }
    }

    // ── Reports ──
    function renderReports() {
        const ym = reportMonth.value;
        const allList = getByMonth(ym);
        // Exclude system adjustments from formal reports
        const list = allList.filter(t =>
            t.category !== 'Balance Added' &&
            t.category !== 'Balance Removed' &&
            t.category !== 'Balance Reset'
        );

        const credits = list.filter(t => t.type === 'credit').sort((a, b) => a.date.localeCompare(b.date));
        const debits = list.filter(t => t.type === 'debit').sort((a, b) => a.date.localeCompare(b.date));

        let totalCredits = 0, totalDebits = 0;
        credits.forEach(t => totalCredits += t.amount);
        debits.forEach(t => totalDebits += t.amount);

        reportCreditsVal.textContent = formatCurrency(totalCredits);
        reportDebitsVal.textContent = formatCurrency(totalDebits);
        reportBalanceVal.textContent = formatCurrency(totalCredits - totalDebits);

        const netBal = totalCredits - totalDebits;
        reportBalanceVal.style.color = netBal >= 0 ? 'var(--blue)' : 'var(--red)';

        const hasData = list.length > 0;

        // Toggle visibility
        reportEmpty.classList.toggle('hidden', hasData);
        $('#reportCreditsTable').style.display = hasData ? '' : 'none';
        $('#reportDebitsTable').style.display = hasData ? '' : 'none';
        $$('.section-title').forEach(el => el.style.display = hasData ? '' : 'none');

        // Credits table
        reportCreditsBody.innerHTML = '';
        credits.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.description)}</td>
        <td>${escapeHtml(t.category)}</td>
        <td class="text-right amount-credit">+${formatCurrency(t.amount)}</td>
      `;
            reportCreditsBody.appendChild(tr);
        });
        reportCreditsFoot.innerHTML = credits.length > 0
            ? `<tr><td colspan="3"><strong>Total Credits</strong></td><td class="text-right amount-credit"><strong>+${formatCurrency(totalCredits)}</strong></td></tr>`
            : '';

        // Debits table
        reportDebitsBody.innerHTML = '';
        debits.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.description)}</td>
        <td>${escapeHtml(t.category)}</td>
        <td class="text-right amount-debit">-${formatCurrency(t.amount)}</td>
      `;
            reportDebitsBody.appendChild(tr);
        });
        reportDebitsFoot.innerHTML = debits.length > 0
            ? `<tr><td colspan="3"><strong>Total Debits</strong></td><td class="text-right amount-debit"><strong>-${formatCurrency(totalDebits)}</strong></td></tr>`
            : '';
    }

    // ── PDF Generation ──
    function generatePDF() {
        const ym = reportMonth.value;
        const allList = getByMonth(ym);
        // Exclude system adjustments from PDF
        const list = allList.filter(t =>
            t.category !== 'Balance Added' &&
            t.category !== 'Balance Removed' &&
            t.category !== 'Balance Reset'
        );

        if (list.length === 0) {
            toast('No transactions to export for this month.', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageW = doc.internal.pageSize.getWidth();

        const credits = list.filter(t => t.type === 'credit').sort((a, b) => a.date.localeCompare(b.date));
        const debits = list.filter(t => t.type === 'debit').sort((a, b) => a.date.localeCompare(b.date));

        let totalCredits = 0, totalDebits = 0;
        credits.forEach(t => totalCredits += t.amount);
        debits.forEach(t => totalDebits += t.amount);

        const argCredits = credits.map((t, i) => [
            i + 1,
            formatDate(t.date),
            t.description,
            t.category,
            formatPDFCurrency(t.amount)
        ]);

        const argDebits = debits.map((t, i) => [
            i + 1,
            formatDate(t.date),
            t.description,
            t.category,
            formatPDFCurrency(t.amount)
        ]);

        const label = monthLabel(ym);

        // ─ Header ─
        doc.setFillColor(15, 23, 42); // Dark Navy
        doc.rect(0, 0, pageW, 45, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(26);
        doc.setFont('helvetica', 'bold');
        doc.text('MoneyWise', 14, 20);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(200, 200, 200);
        doc.text('Smart Money Management — Monthly Financial Statement', 14, 28);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(label, pageW - 14, 20, { align: 'right' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 180, 180);
        doc.text('Statement Generated: ' + new Date().toLocaleDateString('en-IN'), pageW - 14, 28, { align: 'right' });

        // ─ Summary Box ─
        let y = 55;
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, y, pageW - 28, 30, 4, 4, 'FD');

        const thirdW = (pageW - 28) / 3;

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.text('Total Credits', 14 + thirdW * 0.5, y + 10, { align: 'center' });
        doc.text('Total Debits', 14 + thirdW * 1.5, y + 10, { align: 'center' });
        doc.text('Net Balance', 14 + thirdW * 2.5, y + 10, { align: 'center' });

        doc.setFontSize(15);

        doc.setTextColor(22, 163, 74); // Green-600
        doc.text(formatPDFCurrency(totalCredits), 14 + thirdW * 0.5, y + 21, { align: 'center' });

        doc.setTextColor(220, 38, 38); // Red-600
        doc.text(formatPDFCurrency(totalDebits), 14 + thirdW * 1.5, y + 21, { align: 'center' });

        const net = totalCredits - totalDebits;
        if (net >= 0) {
            doc.setTextColor(37, 99, 235); // Blue-600
        } else {
            doc.setTextColor(220, 38, 38); // Red-600
        }
        doc.text(formatPDFCurrency(net), 14 + thirdW * 2.5, y + 21, { align: 'center' });

        y += 45;

        // ─ Table Helper Settings ─
        const commonTableOptions = {
            theme: 'grid',
            headStyles: { textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 3 },
            bodyStyles: { fontSize: 9, textColor: [30, 41, 59], cellPadding: 2.5 },
            footStyles: { fontStyle: 'bold', fontSize: 10, cellPadding: 3 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: 14, right: 14 },
            columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 4: { halign: 'right' } }
        };

        // ─ Credits Table ─
        if (credits.length > 0) {
            doc.setTextColor(22, 163, 74);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('Credits (Income)', 14, y);
            y += 6;

            doc.autoTable({
                ...commonTableOptions,
                startY: y,
                head: [['#', 'Date', 'Description', 'Category', 'Amount (Rs.)']],
                body: argCredits,
                foot: [['', '', '', 'Total Credits', formatPDFCurrency(totalCredits)]],
                headStyles: { ...commonTableOptions.headStyles, fillColor: [22, 163, 74] },
                footStyles: { ...commonTableOptions.footStyles, fillColor: [240, 253, 244], textColor: [22, 163, 74] },
            });

            y = doc.lastAutoTable.finalY + 15;
        }

        // ─ Debits Table ─
        if (debits.length > 0) {
            if (y > 220) { doc.addPage(); y = 20; }

            doc.setTextColor(220, 38, 38);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('Debits (Expenses)', 14, y);
            y += 6;

            doc.autoTable({
                ...commonTableOptions,
                startY: y,
                head: [['#', 'Date', 'Description', 'Category', 'Amount (Rs.)']],
                body: argDebits,
                foot: [['', '', '', 'Total Debits', formatPDFCurrency(totalDebits)]],
                headStyles: { ...commonTableOptions.headStyles, fillColor: [220, 38, 38] },
                footStyles: { ...commonTableOptions.footStyles, fillColor: [254, 242, 242], textColor: [220, 38, 38] },
            });
        }

        // ─ Footer ─
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('MoneyWise — Financial Statement', 14, doc.internal.pageSize.getHeight() - 8);
            doc.text(`Page ${i} of ${pageCount}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
        }

        doc.save(`MoneyWise_${label.replace(' ', '_')}.pdf`);
        toast(`PDF downloaded for ${label}`, 'success');
    }

    // ── Modal Logic ──
    function openModal(editId) {
        if (editId) {
            const tx = transactions.find(t => t.id === editId);
            if (!tx) return;
            modalTitle.textContent = 'Edit Transaction';
            modalSaveBtn.textContent = 'Update Transaction';
            txId.value = tx.id;
            txAmount.value = tx.amount;
            txDate.value = tx.date;
            txCategory.value = tx.category;
            txDescription.value = tx.description;
            setType(tx.type);
        } else {
            modalTitle.textContent = 'Add Transaction';
            modalSaveBtn.textContent = 'Save Transaction';
            txForm.reset();
            txId.value = '';
            txDate.value = new Date().toISOString().split('T')[0];
            setType('credit');
        }
        modalOverlay.classList.add('show');
        setTimeout(() => txAmount.focus(), 100);
    }

    function closeModal() {
        modalOverlay.classList.remove('show');
    }

    function setType(type) {
        currentType = type;
        typeCreditBtn.classList.toggle('active', type === 'credit');
        typeDebitBtn.classList.toggle('active', type === 'debit');
    }

    function handleFormSubmit(e) {
        e.preventDefault();

        const amount = parseFloat(txAmount.value);
        const date = txDate.value;
        const category = txCategory.value;
        const description = txDescription.value.trim();

        if (!amount || amount <= 0 || !date || !category || !description) {
            toast('Please fill in all required fields.', 'error');
            return;
        }

        if (txId.value) {
            // Edit — reverse old, apply new
            const oldTx = transactions.find(t => t.id === txId.value);
            if (oldTx) {
                reverseBalance(oldTx.type, oldTx.amount);
            }
            updateTransaction(txId.value, { type: currentType, amount, date, category, description });
            adjustBalance(currentType, amount);
            toast('Transaction updated successfully!', 'success');
        } else {
            // Add
            addTransaction({ id: uuid(), type: currentType, amount, date, category, description });
            adjustBalance(currentType, amount);
            toast('Transaction added successfully!', 'success');
        }

        closeModal();
        refreshCurrentView();
    }

    // ── Delete Logic ──
    function openDeleteModal(id) {
        deleteTargetId = id;
        deleteOverlay.classList.add('show');
    }

    function closeDeleteModal() {
        deleteTargetId = null;
        deleteOverlay.classList.remove('show');
    }

    function confirmDelete() {
        if (deleteTargetId) {
            const tx = transactions.find(t => t.id === deleteTargetId);
            if (tx) reverseBalance(tx.type, tx.amount);
            deleteTransaction(deleteTargetId);
            toast('Transaction deleted.', 'info');
            closeDeleteModal();
            refreshCurrentView();
        }
    }

    // ── Refresh ──
    function refreshCurrentView() {
        const active = document.querySelector('.nav-link.active');
        if (active) {
            const view = active.getAttribute('data-view');
            if (view === 'dashboard') renderDashboard();
            else if (view === 'transactions') renderTransactions();
            else if (view === 'reports') renderReports();
        }
    }

    // ── HTML Escape ──
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Event Delegation for Table Actions ──
    document.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-edit]');
        if (editBtn) { openModal(editBtn.dataset.edit); return; }

        const deleteBtn = e.target.closest('[data-delete]');
        if (deleteBtn) { openDeleteModal(deleteBtn.dataset.delete); return; }
    });

    // ── Initialize ──
    function init() {
        load();
        loadBalance();

        // Set month inputs to current month
        const cm = currentMonthStr();
        dashboardMonth.value = cm;
        filterMonth.value = cm;
        reportMonth.value = cm;

        // Navigation
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                location.hash = view;
                navigate(view);
            });
        });

        $('#viewAllBtn').addEventListener('click', (e) => {
            e.preventDefault();
            location.hash = 'transactions';
            navigate('transactions');
        });

        window.addEventListener('hashchange', initRouter);

        // Mobile sidebar
        hamburger.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            hamburger.classList.toggle('open');
            overlay.classList.toggle('show');
        });
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            hamburger.classList.remove('open');
            overlay.classList.remove('show');
        });

        // Dashboard month change
        dashboardMonth.addEventListener('change', renderDashboard);

        // Transaction filters
        filterMonth.addEventListener('change', renderTransactions);
        filterType.addEventListener('change', renderTransactions);
        filterCategory.addEventListener('change', renderTransactions);
        filterSearch.addEventListener('input', renderTransactions);

        // Report month change
        reportMonth.addEventListener('change', renderReports);

        // Add transaction button
        addTransactionBtn.addEventListener('click', () => openModal(null));

        // Modal
        modalClose.addEventListener('click', closeModal);
        modalCancelBtn.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

        // Type toggle
        typeCreditBtn.addEventListener('click', () => setType('credit'));
        typeDebitBtn.addEventListener('click', () => setType('debit'));

        // Form submit
        txForm.addEventListener('submit', handleFormSubmit);

        // Delete modal
        deleteClose.addEventListener('click', closeDeleteModal);
        deleteCancelBtn.addEventListener('click', closeDeleteModal);
        deleteConfirmBtn.addEventListener('click', confirmDelete);
        deleteOverlay.addEventListener('click', (e) => { if (e.target === deleteOverlay) closeDeleteModal(); });

        // PDF download
        downloadPdfBtn.addEventListener('click', generatePDF);

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (modalOverlay.classList.contains('show')) closeModal();
                if (deleteOverlay.classList.contains('show')) closeDeleteModal();
                if ($('#balanceOverlay').classList.contains('show')) closeBalanceModal();
            }
        });

        // ── Wallet Balance Modal ──
        const balanceOverlay = $('#balanceOverlay');
        const balanceClose = $('#balanceClose');
        const balanceCancelBtn = $('#balanceCancelBtn');
        const balanceForm = $('#balanceForm');
        const balanceAmount = $('#balanceAmount');
        const balanceModalTitle = $('#balanceModalTitle');
        const balanceAmountLabel = $('#balanceAmountLabel');
        const balanceSaveBtn = $('#balanceSaveBtn');

        let balanceMode = 'add'; // 'add' or 'remove'

        function openBalanceModal(mode) {
            balanceMode = mode;
            balanceForm.reset();

            if (mode === 'add') {
                balanceModalTitle.textContent = 'Add Balance';
                balanceAmountLabel.innerHTML = 'Amount to Add (₹) <span class="required">*</span>';
                balanceSaveBtn.textContent = 'Add to Balance';
                balanceSaveBtn.className = 'btn btn-primary';
            } else {
                balanceModalTitle.textContent = 'Remove Balance';
                balanceAmountLabel.innerHTML = 'Amount to Remove (₹) <span class="required">*</span>';
                balanceSaveBtn.textContent = 'Remove from Balance';
                balanceSaveBtn.className = 'btn btn-danger';
            }

            balanceOverlay.classList.add('show');
            setTimeout(() => balanceAmount.focus(), 100);
        }

        function closeBalanceModal() {
            balanceOverlay.classList.remove('show');
        }

        $('#addBalanceBtn').addEventListener('click', () => openBalanceModal('add'));
        $('#removeBalanceBtn').addEventListener('click', () => openBalanceModal('remove'));
        $('#resetBalanceBtn').addEventListener('click', resetBalance);
        balanceClose.addEventListener('click', closeBalanceModal);
        balanceCancelBtn.addEventListener('click', closeBalanceModal);
        balanceOverlay.addEventListener('click', (e) => { if (e.target === balanceOverlay) closeBalanceModal(); });

        balanceForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const amt = parseFloat(balanceAmount.value);
            if (!amt || amt <= 0) {
                toast('Please enter a valid amount.', 'error');
                return;
            }

            const today = new Date().toISOString().split('T')[0];

            if (balanceMode === 'add') {
                totalBalance += amt;
                saveBalance();
                addTransaction({
                    id: uuid(),
                    type: 'credit',
                    amount: amt,
                    date: today,
                    category: 'Balance Added',
                    description: 'Balance added to wallet'
                });
                toast(`₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} added to balance!`, 'success');
            } else {
                totalBalance -= amt;
                saveBalance();
                addTransaction({
                    id: uuid(),
                    type: 'debit',
                    amount: amt,
                    date: today,
                    category: 'Balance Removed',
                    description: 'Balance removed from wallet'
                });
                toast(`₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} removed from balance!`, 'info');
            }

            renderTotalBalance();
            closeBalanceModal();
            refreshCurrentView();
        });

        // Initial render
        initRouter();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
