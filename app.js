// Modal utilities
function showModal({ title = "", content = "", inputValue = "", okText = "OK", cancelText = "Cancel", onOk, onCancel }) {
  const overlay = document.getElementById("modal-overlay");
  const contentDiv = document.getElementById("modal-content");
  const actionsDiv = document.getElementById("modal-actions");
  contentDiv.innerHTML = title ? `<h3 style="margin-bottom:16px;font-size:1.2rem;font-weight:700;">${title}</h3>` : "";
  if (inputValue !== undefined) {
    contentDiv.innerHTML += `<input id="modal-input" type="text" value="${inputValue}" style="width:100%;padding:10px;font-size:1rem;border-radius:8px;border:1px solid #d1d5db;" />`;
  } else {
    contentDiv.innerHTML += `<div>${content}</div>`;
  }
  actionsDiv.innerHTML = `
    <button id="modal-cancel" class="btn-gray">${cancelText}</button>
    <button id="modal-ok" class="btn-indigo">${okText}</button>
  `;
  overlay.style.display = "flex";
  document.getElementById("modal-input")?.focus();

  document.getElementById("modal-cancel").onclick = () => {
    overlay.style.display = "none";
    if (onCancel) onCancel();
  };
  document.getElementById("modal-ok").onclick = () => {
    overlay.style.display = "none";
    if (onOk) onOk(document.getElementById("modal-input")?.value);
  };
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.style.display = "none";
      if (onCancel) onCancel();
    }
  };
  document.onkeydown = (e) => {
    if (e.key === "Escape") {
      overlay.style.display = "none";
      if (onCancel) onCancel();
    }
    if (e.key === "Enter" && document.activeElement === document.getElementById("modal-input")) {
      overlay.style.display = "none";
      if (onOk) onOk(document.getElementById("modal-input")?.value);
    }
  };
}

// Firebase modular imports (already loaded in index.html)
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// Firebase setup (already initialized in index.html)
const db = getFirestore();
const auth = getAuth();

let user = null;

// App data
let years = [];
let currentYear = "";
let categories = [];
let transactions = [];
let currentMonth = "";
let filterMonth = "";
let filterCategory = "";

// DOM elements
const yearSelect = document.getElementById("year-select");
const monthFilter = document.getElementById("month-filter");
const categoryFilter = document.getElementById("category-filter");
const transactionsTbody = document.getElementById("transactions-tbody");
const balanceSpan = document.getElementById("balance");
const totalIncomeSpan = document.getElementById("total-income");
const totalExpenseSpan = document.getElementById("total-expense");
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// --- FIRESTORE HELPERS ---

function userDoc() {
  return user ? doc(db, "users", user.uid) : null;
}
function yearDoc(year) {
  return user ? doc(db, "users", user.uid, "cashbook", String(year)) : null;
}
function metaDoc() {
  return user ? doc(db, "users", user.uid, "cashbook-meta", "meta") : null;
}

// --- LOAD & SAVE ---

async function loadAllData() {
  if (!user) return;
  // Load meta (years, categories, filters, currentYear, currentMonth)
  const metaSnap = await getDoc(metaDoc());
  if (metaSnap.exists()) {
    const meta = metaSnap.data();
    years = meta.years || [new Date().getFullYear()];
    categories = meta.categories || ["Food", "Transport", "Salary"];
    currentYear = meta.currentYear || years[0];
    currentMonth = meta.currentMonth || "";
    filterMonth = meta.filterMonth || "";
    filterCategory = meta.filterCategory || "";
  } else {
    years = [new Date().getFullYear()];
    categories = ["Food", "Transport", "Salary"];
    currentYear = years[0];
    currentMonth = "";
    filterMonth = "";
    filterCategory = "";
    await saveMeta();
  }
  // Load transactions for current year
  await loadTransactions(currentYear);
  renderYears();
  renderCategories();
  renderMonths();
  renderTransactions();
}

async function saveMeta() {
  if (!user) return;
  await setDoc(
    metaDoc(),
    {
      years,
      categories,
      currentYear,
      currentMonth,
      filterMonth,
      filterCategory,
    },
    { merge: true }
  );
}

async function loadTransactions(year) {
  if (!user) return;
  const txnSnap = await getDoc(yearDoc(year));
  if (txnSnap.exists()) {
    transactions = txnSnap.data().transactions || [];
  } else {
    transactions = [];
    await saveTransactions();
  }
}

async function saveTransactions() {
  if (!user) return;
  await setDoc(yearDoc(currentYear), { transactions }, { merge: true });
}

// --- RENDER FUNCTIONS ---

function renderYears() {
  yearSelect.innerHTML = "";
  years.forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y == currentYear) opt.selected = true;
    yearSelect.appendChild(opt);
  });
}

function renderCategories() {
  categoryFilter.innerHTML = '<option value="">All</option>';
  categories.forEach((cat) => {
    const opt2 = document.createElement("option");
    opt2.value = cat;
    opt2.textContent = cat;
    if (cat === filterCategory) opt2.selected = true;
    categoryFilter.appendChild(opt2);
  });
}

function renderMonths() {
  monthFilter.innerHTML = '<option value="">All</option>';
  months.forEach((m) => {
    const opt2 = document.createElement("option");
    opt2.value = m;
    opt2.textContent = m;
    if (m === filterMonth) opt2.selected = true;
    monthFilter.appendChild(opt2);
  });
}

function renderSummary(filteredTxns) {
  let income = 0,
    expense = 0;
  filteredTxns.forEach((t) => {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  });
  const balance = income - expense;
  balanceSpan.textContent = `৳${balance.toFixed(2)}`;
  totalIncomeSpan.textContent = `৳${income.toFixed(2)}`;
  totalExpenseSpan.textContent = `৳${expense.toFixed(2)}`;
}

function renderTransactions() {
  transactionsTbody.innerHTML = "";
  let filteredTxns = transactions.filter((t) => (!filterCategory || t.category === filterCategory) && (!filterMonth || t.month === filterMonth));
  filteredTxns.forEach((t, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Date">${t.date}</td>
      <td data-label="Description">${t.description}</td>
      <td data-label="Amount" class="font-bold ${t.type === "income" ? "text-blue-700" : "text-red-600"}">৳${t.amount.toFixed(2)}</td>
      <td data-label="Type" class="capitalize">${t.type}</td>
      <td data-label="Category">${t.category}</td>
      <td data-label="Month">${t.month}</td>
      <td data-label="Actions">
        <button class="text-red-600 hover:text-red-900 font-bold" onclick="deleteTransaction(${i})" title="Delete Transaction">🗑️</button>
      </td>
    `;
    transactionsTbody.appendChild(tr);
  });
  renderSummary(filteredTxns);
  renderFilterSummary();
}

function renderFilterSummary() {
  const filterSummary = document.getElementById("filter-summary");
  let summary = "";
  if (filterMonth) summary += filterMonth;
  if (filterCategory) summary += (summary ? " | " : "") + filterCategory;
  filterSummary.textContent = summary;
}

// --- CATEGORY DRAWER ---

function renderCategoryDrawer() {
  let html = `
    <h2 style="font-size:1.5rem;font-weight:700;color:#4338ca;margin-bottom:16px">Categories</h2>
    <div style="display:flex;gap:12px;margin-bottom:16px">
      <input type="text" id="drawer-new-category" placeholder="New Category" style="flex-grow:1" />
      <button id="drawer-add-category" class="btn-green">Add</button>
    </div>
    <div id="drawer-category-chips" class="category-chips"></div>
  `;
  openDrawer(html);

  // Render chips
  const chipsDiv = document.getElementById("drawer-category-chips");
  chipsDiv.innerHTML = "";
  categories.forEach((cat, idx) => {
    const chip = document.createElement("div");
    chip.className = "category-chip";
    chip.textContent = cat;

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "text-indigo-600";
    editBtn.title = "Edit Category";
    editBtn.innerHTML = "✏️";
    editBtn.onclick = async (e) => {
      e.stopPropagation();
      showModal({
        title: "Rename category",
        inputValue: cat,
        okText: "Save",
        cancelText: "Cancel",
        onOk: async (newName) => {
          if (newName && newName.trim() && !categories.includes(newName.trim())) {
            categories[idx] = newName.trim();
            await saveMeta();
            renderCategoryDrawer();
            renderCategories();
            renderTransactions();
          }
        },
      });
    };

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "text-red-600";
    delBtn.title = "Delete Category";
    delBtn.innerHTML = "🗑️";
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      showModal({
        title: "Delete Category",
        content: `Delete category "<b>${cat}</b>"?<br>Transactions will keep old category name.`,
        okText: "Delete",
        cancelText: "Cancel",
        onOk: async () => {
          categories.splice(idx, 1);
          await saveMeta();
          renderCategoryDrawer();
          renderCategories();
          renderTransactions();
        },
      });
    };

    chip.appendChild(editBtn);
    chip.appendChild(delBtn);
    chipsDiv.appendChild(chip);
  });

  // Add category events
  document.getElementById("drawer-add-category").onclick = async () => {
    const newCatInput = document.getElementById("drawer-new-category");
    const newCat = newCatInput.value.trim();
    if (!newCat) return alert("Category name cannot be empty");
    if (categories.includes(newCat)) return alert("Category already exists");
    categories.push(newCat);
    await saveMeta();
    renderCategoryDrawer();
    renderCategories();
    newCatInput.value = "";
  };
  document.getElementById("drawer-new-category").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("drawer-add-category").click();
    }
  });
}

// --- DRAWER UTILS ---

function openDrawer(contentHtml) {
  document.getElementById("drawer-content").innerHTML = contentHtml;
  document.getElementById("drawer-overlay").style.display = "block";
  document.getElementById("drawer-sidebar").style.display = "flex";
  document.body.classList.add("drawer-open");
  setTimeout(() => {
    document.getElementById("drawer-sidebar").classList.remove("hide");
  }, 10);
}
function closeDrawer() {
  document.getElementById("drawer-sidebar").classList.add("hide");
  setTimeout(() => {
    document.getElementById("drawer-overlay").style.display = "none";
    document.getElementById("drawer-sidebar").style.display = "none";
    document.body.classList.remove("drawer-open");
    document.getElementById("drawer-sidebar").classList.remove("hide");
  }, 300);
}
document.getElementById("drawer-close").onclick = closeDrawer;
document.getElementById("drawer-overlay").onclick = closeDrawer;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

// --- TRANSACTION DRAWER ---

function renderTransactionDrawer(type = "income") {
  let html = `
    <h2 style="font-size:1.5rem;font-weight:700;color:#4338ca;margin-bottom:16px">${type === "income" ? "Add Income" : "Add Expense"}</h2>
    <form id="drawer-transaction-form" style="display:grid;gap:16px;">
      <div style="position:relative;flex:1;">
        <input type="text" id="drawer-date" required placeholder="Select date" style="width:100%;padding:12px 44px 12px 16px;font-size:1.1rem;border-radius:8px;border:1px solid #d1d5db;cursor:pointer;background:#f8fafc;" readonly />
        <span style="position:absolute;right:16px;top:50%;transform:translateY(-50%);pointer-events:none;">
            <svg width="22" height="22" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="4"></rect>
            <path d="M16 2v4M8 2v4M3 10h18"></path>
            </svg>
        </span>
        </div>
      <input type="text" id="drawer-description" placeholder="Description" required />
      <input type="number" id="drawer-amount" placeholder="Amount" step="0.01" required />
      <select id="drawer-type">
        <option value="expense" ${type === "expense" ? "selected" : ""}>Expense</option>
        <option value="income" ${type === "income" ? "selected" : ""}>Income</option>
      </select>
      <select id="drawer-category"></select>
      <select id="drawer-month"></select>
      <button type="submit" class="btn-indigo">${type === "income" ? "Add Income" : "Add Expense"}</button>
    </form>
  `;
  openDrawer(html);
  flatpickr("#drawer-date", {
    dateFormat: "Y-m-d",
    allowInput: true,
    clickOpens: true,
    defaultDate: new Date(),
    wrap: false,
  });
  // Populate category and month selects
  const catSelect = document.getElementById("drawer-category");
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);
  });
  const monthSelectEl = document.getElementById("drawer-month");
  months.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    monthSelectEl.appendChild(opt);
  });

  // Set default month if available
  if (currentMonth) monthSelectEl.value = currentMonth;

  // Handle type switching
  const typeSelect = document.getElementById("drawer-type");
  typeSelect.value = type;

  // Form submit handler
  document.getElementById("drawer-transaction-form").onsubmit = async function (e) {
    e.preventDefault();
    const date = document.getElementById("drawer-date").value;
    const description = document.getElementById("drawer-description").value.trim();
    const amount = parseFloat(document.getElementById("drawer-amount").value);
    const typeVal = document.getElementById("drawer-type").value;
    const category = catSelect.value;
    const month = monthSelectEl.value || currentMonth || months[new Date(date).getMonth()] || "";

    if (!month) {
      alert("Please select a month.");
      return;
    }
    transactions.push({ date, description, amount, type: typeVal, category, month });
    await saveTransactions();
    renderTransactions();
    closeDrawer();
  };
}

// --- DELETE TRANSACTION ---

window.deleteTransaction = async function (index) {
  let filteredTxns = transactions.filter((t) => (!filterCategory || t.category === filterCategory) && (!filterMonth || t.month === filterMonth));
  const txnToDelete = filteredTxns[index];
  const realIndex = transactions.findIndex(
    (t) =>
      t.date === txnToDelete.date &&
      t.description === txnToDelete.description &&
      t.amount === txnToDelete.amount &&
      t.type === txnToDelete.type &&
      t.category === txnToDelete.category &&
      t.month === txnToDelete.month
  );
  if (realIndex !== -1) {
    showModal({
      title: "Delete Transaction",
      content: "Are you sure you want to delete this transaction?",
      okText: "Delete",
      cancelText: "Cancel",
      onOk: async () => {
        transactions.splice(realIndex, 1);
        await saveTransactions();
        renderTransactions();
      },
    });
  }
};

// --- EVENT LISTENERS ---

// Add year
document.getElementById("new-year").addEventListener("click", async () => {
  showModal({
    title: "Add Year",
    inputValue: "",
    okText: "Add",
    cancelText: "Cancel",
    onOk: async (y) => {
      if (!y) return;
      y = y.trim();
      if (!/^\d{4}$/.test(y)) return alert("Please enter a valid year (e.g., 2025)");
      y = parseInt(y, 10);
      if (years.includes(y)) return alert("Year already exists");
      years.push(y);
      years.sort((a, b) => a - b);
      currentYear = y;
      await saveMeta();
      await loadTransactions(currentYear);
      renderYears();
      renderTransactions();
    },
  });
});

// Change year select
yearSelect.addEventListener("change", async () => {
  currentYear = yearSelect.value;
  await saveMeta();
  await loadTransactions(currentYear);
  renderTransactions();
});

// Change month filter select
monthFilter.addEventListener("change", async () => {
  filterMonth = monthFilter.value;
  await saveMeta();
  renderTransactions();
  renderFilterSummary();
});

// Change category filter select
categoryFilter.addEventListener("change", async () => {
  filterCategory = categoryFilter.value;
  await saveMeta();
  renderTransactions();
  renderFilterSummary();
});

// Clear filters button
document.getElementById("clear-filters").addEventListener("click", async () => {
  filterCategory = "";
  filterMonth = "";
  categoryFilter.value = "";
  monthFilter.value = "";
  await saveMeta();
  renderTransactions();
});

// Delete all transactions button
document.getElementById("delete-all").addEventListener("click", async () => {
  showModal({
    title: "Delete All Transactions",
    content: `Delete <b>ALL</b> transactions for year ${currentYear}?`,
    okText: "Delete All",
    cancelText: "Cancel",
    onOk: async () => {
      transactions = [];
      await saveTransactions();
      renderTransactions();
    },
  });
});

// Export PDF button - only show filtered transactions and summary
document.getElementById("export-pdf").addEventListener("click", () => {
  window.print();
});

// Open Category Drawer Event
document.getElementById("open-category-drawer").onclick = renderCategoryDrawer;
document.getElementById("open-income-drawer").onclick = () => renderTransactionDrawer("income");
document.getElementById("open-expense-drawer").onclick = () => renderTransactionDrawer("expense");

// --- AUTH STATE ---

onAuthStateChanged(auth, async (firebaseUser) => {
  user = firebaseUser;
  if (user) {
    await loadAllData();
  } else {
    // Optionally clear UI or show a message
    years = [];
    categories = [];
    transactions = [];
    currentYear = "";
    currentMonth = "";
    filterMonth = "";
    filterCategory = "";
    renderYears();
    renderCategories();
    renderMonths();
    renderTransactions();
  }
});

// --- INITIALIZE ---
