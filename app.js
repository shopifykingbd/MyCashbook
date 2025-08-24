// --- LOCAL STORAGE FOR LAST ENTRY ---
let lastEntryCategory = localStorage.getItem("lastEntryCategory") || "";
let lastEntryMonth = localStorage.getItem("lastEntryMonth") || "";

// --- MODAL UTILITIES ---
/**
 * Show a modal dialog.
 * @param {Object} options - Modal options.
 */
function showModal({ title = "", content = "", inputValue, okText = "OK", cancelText = "Cancel", onOk, onCancel }) {
  const overlay = document.getElementById("modal-overlay");
  const contentDiv = document.getElementById("modal-content");
  const actionsDiv = document.getElementById("modal-actions");
  contentDiv.innerHTML = title ? `<h3 style="margin-bottom:16px;font-size:1.2rem;font-weight:700;">${title}</h3>` : "";
  // Show input if inputValue is provided
  if (typeof inputValue !== "undefined") {
    contentDiv.innerHTML += `<input id="modal-input" type="text" value="${inputValue}" style="width:100%;padding:10px;font-size:1rem;border-radius:8px;border:1px solid #d1d5db;" />`;
  } else {
    contentDiv.innerHTML += `<div>${content}</div>`;
  }
  actionsDiv.innerHTML = `
    <button id="modal-cancel" class="btn-gray">${cancelText}</button>
    <button id="modal-ok" class="btn-red">${okText}</button>
  `;
  overlay.style.display = "flex";
  const modalInput = document.getElementById("modal-input");
  if (modalInput) {
    modalInput.focus();
    modalInput.setSelectionRange(modalInput.value.length, modalInput.value.length);
  }

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
  };
}

// --- FIREBASE IMPORTS & SETUP ---
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

// --- APP STATE ---
let user = null;
let years = [];
let currentYear = "";
let categories = [];
let transactions = [];
let currentPage = 1;
const entriesPerPage = 50;
let currentMonth = "";
let filterMonth = "";
let filterCategory = "";

// --- DOM ELEMENTS ---
const yearSelect = document.getElementById("year-select");
const monthFilter = document.getElementById("month-filter");
const categoryFilter = document.getElementById("category-filter");
const transactionsTbody = document.getElementById("transactions-tbody");
const balanceSpan = document.getElementById("balance");
const totalIncomeSpan = document.getElementById("total-income");
const totalExpenseSpan = document.getElementById("total-expense");
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// --- FIRESTORE DOC HELPERS ---
function userDoc() {
  return user ? doc(db, "users", user.uid) : null;
}
function yearDoc(year) {
  return user ? doc(db, "users", user.uid, "cashbook", String(year)) : null;
}
function metaDoc() {
  return user ? doc(db, "users", user.uid, "cashbook-meta", "meta") : null;
}

// --- LOAD & SAVE FUNCTIONS ---
/**
 * Load all app data for the current user.
 */
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
  await loadTransactions(currentYear);
  renderYears();
  renderCategories();
  renderMonths();
  renderTransactions();
}

/**
 * Save meta info (years, categories, filters, etc).
 */
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

/**
 * Load transactions for a given year.
 * @param {string|number} year
 */
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

/**
 * Save all transactions for the current year.
 */
async function saveTransactions() {
  if (!user) return;
  await setDoc(yearDoc(currentYear), { transactions }, { merge: true });
}

// --- RENDER FUNCTIONS ---

/**
 * Render year dropdown.
 */
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

/**
 * Render category filter dropdown.
 */
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

/**
 * Render month filter dropdown.
 */
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

/**
 * Render summary cards.
 * @param {Array} filteredTxns
 */
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

/**
 * Render transactions table with pagination.
 */
function renderTransactions() {
  transactionsTbody.innerHTML = "";
  let filteredTxns = transactions.filter((t) => (!filterCategory || t.category === filterCategory) && (!filterMonth || t.month === filterMonth));

  // Pagination logic
  const totalEntries = filteredTxns.length;
  const totalPages = Math.ceil(totalEntries / entriesPerPage);
  if (currentPage > totalPages) currentPage = totalPages || 1;
  const startIdx = (currentPage - 1) * entriesPerPage;
  const endIdx = startIdx + entriesPerPage;
  const pageTxns = filteredTxns.slice(startIdx, endIdx);

  pageTxns.forEach((t, i) => {
    const tr = document.createElement("tr");
    tr.className = "transaction-row";
    tr.setAttribute("data-index", startIdx + i);
    tr.innerHTML = `
      <td><input type="checkbox" class="txn-checkbox" data-index="${startIdx + i}"></td>
      <td data-label="Date">${t.date}</td>
      <td data-label="Description">${t.description}${t.edited ? ' <span class="edited-label">(Edited)</span>' : ""}</td>
      <td data-label="Amount" class="font-bold ${t.type === "income" ? "text-blue-700" : "text-red-600"}">৳${t.amount.toLocaleString()}</td>
      <td data-label="Type" class="capitalize">${t.type}</td>
      <td data-label="Category">${t.category}</td>
      <td data-label="Month">${t.month}</td>
      <td data-label="Actions" class="actions-cell">
        <button class="action-icon-btn edit" title="Edit" tabindex="-1" style="opacity:0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z" />
          </svg>
        </button>
        <button class="action-icon-btn delete" title="Delete" tabindex="-1" style="opacity:0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </td>
    `;
    transactionsTbody.appendChild(tr);
  });

  renderSummary(pageTxns);
  renderFilterSummary();
  renderPagination(totalPages, totalEntries, startIdx, endIdx);

  // Mouseover for action buttons
  document.querySelectorAll(".transaction-row").forEach((row) => {
    row.addEventListener("mouseenter", () => {
      row.querySelectorAll(".action-icon-btn").forEach((btn) => (btn.style.opacity = "1"));
      row.style.background = "#eef1fb";
    });
    row.addEventListener("mouseleave", () => {
      row.querySelectorAll(".action-icon-btn").forEach((btn) => (btn.style.opacity = "0"));
      row.style.background = "";
    });
    // Edit button
    row.querySelector(".action-icon-btn.edit").onclick = () => openEditDrawer(row.getAttribute("data-index"));
    // Delete button
    row.querySelector(".action-icon-btn.delete").onclick = () => openDeleteModal(row.getAttribute("data-index"));
    // Checkbox
    row.querySelector(".txn-checkbox").onchange = handleSelectionChange;
  });
}

/**
 * Render pagination controls.
 */
function renderPagination(totalPages, totalEntries, startIdx, endIdx) {
  let paginationDiv = document.getElementById("pagination-controls");
  if (!paginationDiv) {
    paginationDiv = document.createElement("div");
    paginationDiv.id = "pagination-controls";
    paginationDiv.className = "pagination-controls";
    // Insert after .transactions-header
    const header = document.querySelector(".transactions-header");
    if (header) header.parentNode.insertBefore(paginationDiv, header.nextSibling);
    else transactionsTbody.parentElement.parentElement.appendChild(paginationDiv);
  }
  paginationDiv.innerHTML = `
    <div class="pagination-row" style="display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:12px;">
      <span class="showing-text" style="font-size:1.08rem;color:#555;">
        Showing ${totalEntries === 0 ? 0 : startIdx + 1} - ${Math.min(endIdx, totalEntries)} of ${totalEntries} entries
        <span id="selected-count"></span>
      </span>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="pagination-dropdown" style="position:relative;">
          <button id="pagination-dropdown-btn" class="pagination-dropdown-btn">
            Page ${currentPage}
            <svg width="18" height="18" style="vertical-align:middle;" fill="none" stroke="#6366f1" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div id="pagination-dropdown-list" class="pagination-dropdown-list" style="display:none;position:absolute;top:110%;left:0;z-index:10;background:#fff;border-radius:12px;box-shadow:0 4px 24px #0002;padding:8px 0;min-width:120px;">
            ${Array.from(
              { length: totalPages },
              (_, i) => `
              <button class="pagination-dropdown-item${currentPage === i + 1 ? " selected" : ""}" data-page="${
                i + 1
              }" style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 18px;font-size:1rem;background:none;border:none;cursor:pointer;">
                <span style="display:inline-block;width:18px;">${
                  currentPage === i + 1
                    ? `<svg width="18" height="18" fill="none" stroke="#6366f1" stroke-width="2"><circle cx="9" cy="9" r="7"/><circle cx="9" cy="9" r="3" fill="#6366f1"/></svg>`
                    : `<svg width="18" height="18" fill="none" stroke="#bbb" stroke-width="2"><circle cx="9" cy="9" r="7"/></svg>`
                }</span>
                Page ${i + 1}
              </button>
            `
            ).join("")}
          </div>
        </div>
        <span style="margin:0 8px;">of ${totalPages || 1}</span>
        <button id="prev-page" class="pagination-btn" ${currentPage === 1 ? "disabled" : ""} aria-label="Previous page">
          <svg width="28" height="28" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 22 9 14 17 6"/></svg>
        </button>
        <button id="next-page" class="pagination-btn" ${currentPage === totalPages || totalPages === 0 ? "disabled" : ""} aria-label="Next page">
          <svg width="28" height="28" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 6 19 14 11 22"/></svg>
        </button>
      </div>
    </div>
  `;

  // Next/Prev
  document.getElementById("prev-page").onclick = () => {
    currentPage--;
    renderTransactions();
  };
  document.getElementById("next-page").onclick = () => {
    currentPage++;
    renderTransactions();
  };

  // Dropdown
  const dropdownBtn = document.getElementById("pagination-dropdown-btn");
  const dropdownList = document.getElementById("pagination-dropdown-list");
  dropdownBtn.onclick = (e) => {
    e.stopPropagation();
    dropdownList.style.display = dropdownList.style.display === "block" ? "none" : "block";
  };
  document.addEventListener("click", () => {
    dropdownList.style.display = "none";
  });
  dropdownList.querySelectorAll(".pagination-dropdown-item").forEach((btn) => {
    btn.onclick = (e) => {
      currentPage = parseInt(btn.getAttribute("data-page"));
      renderTransactions();
      dropdownList.style.display = "none";
    };
  });
}

// --- Always show Export PDF, and change its logic based on selection ---
function updateHeaderActions() {
  let selectedCount = selectedIndexes.length;
  let selectedCountSpan = document.getElementById("selected-count");
  if (selectedCountSpan) {
    selectedCountSpan.textContent = selectedCount > 0 ? ` | ${selectedCount} selected in this page` : "";
  }
  let actionsDiv = document.querySelector(".transactions-actions");
  if (!actionsDiv) return;
  actionsDiv.innerHTML = "";

  // Always show Export PDF
  actionsDiv.innerHTML += `<button id="export-pdf" class="btn-gray">Export PDF</button>`;

  // Export PDF logic: export selected if any, else all
  document.getElementById("export-pdf").onclick = () => {
    let txnsToExport = [];
    if (selectedIndexes.length > 0) {
      txnsToExport = selectedIndexes.map((idx) => transactions[idx]);
    } else {
      txnsToExport = transactions;
    }
    exportTransactionsToPDF(txnsToExport);
  };

  // Show delete buttons as appropriate
  if (selectedCount === 1) {
    actionsDiv.innerHTML += `<button id="delete-selected" class="btn-red">Delete</button>`;
    document.getElementById("delete-selected").onclick = () => openDeleteModal(selectedIndexes[0]);
  } else if (selectedCount > 1) {
    actionsDiv.innerHTML += `<button id="delete-selected-all" class="btn-red">Delete Selected</button>`;
    document.getElementById("delete-selected-all").onclick = () => openDeleteModal(selectedIndexes);
  } else {
    actionsDiv.innerHTML += `<button id="delete-all" class="btn-red">Delete All</button>`;
    document.getElementById("delete-all").onclick = async () => {
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
    };
  }
}

// Dummy PDF export function (replace with your actual logic)
function exportTransactionsToPDF(txns) {
  // Implement your PDF export logic here
  // For now, just alert how many will be exported
  alert(`Exporting ${txns.length} transaction(s) to PDF`);
}

/**
 * Render filter summary.
 */
function renderFilterSummary() {
  const filterSummary = document.getElementById("filter-summary");
  let summary = "";
  if (filterMonth) summary += filterMonth;
  if (filterCategory) summary += (summary ? " | " : "") + filterCategory;
  filterSummary.textContent = summary;
}

// --- CATEGORY DRAWER & MENU ---
/**
 * Render the category drawer with 3-dot menu for each category.
 */
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
    const row = document.createElement("div");
    row.className = "category-row";

    // Chip
    const chip = document.createElement("div");
    chip.className = "category-chip";
    chip.textContent = cat;

    // 3-dot menu button
    const menuBtn = document.createElement("button");
    menuBtn.className = "category-menu-btn";
    menuBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="6" r="1.5"/>
        <circle cx="12" cy="12" r="1.5"/>
        <circle cx="12" cy="18" r="1.5"/>
      </svg>
    `;

    // Menu
    const menu = document.createElement("div");
    menu.className = "category-menu";
    menu.innerHTML = `
      <button class="category-menu-item rename">Rename</button>
      <button class="category-menu-item delete">Delete</button>
    `;

    // Show/hide menu logic
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      // Close other open menus
      document.querySelectorAll(".category-menu.open").forEach((m) => m.classList.remove("open"));
      menu.classList.toggle("open");
    };
    // Close menu on click outside
    document.addEventListener("click", () => menu.classList.remove("open"));

    // Rename
    menu.querySelector(".rename").onclick = (e) => {
      e.stopPropagation();
      menu.classList.remove("open");
      showModal({
        title: "Rename Category",
        content: `
          <div style="margin-bottom:18px;">
            <label style="font-size:1.1rem;font-weight:500;display:block;margin-bottom:8px;">Category Name</label>
            <input id="modal-input" type="text" value="${cat}" style="width:100%;padding:12px 14px;font-size:1.1rem;border-radius:8px;border:2px solid #2563eb;outline:none;" />
          </div>
        `,
        okText: "Update",
        cancelText: "Cancel",
        onOk: async () => {
          const newName = document.getElementById("modal-input").value.trim();
          if (newName && !categories.includes(newName)) {
            categories[idx] = newName;
            await saveMeta();
            renderCategoryDrawer();
            renderCategories();
            renderTransactions();
          }
        },
      });
      setTimeout(() => {
        document.getElementById("modal-input").focus();
        document.getElementById("modal-input").select();
      }, 100);
    };

    // Delete
    menu.querySelector(".delete").onclick = (e) => {
      e.stopPropagation();
      menu.classList.remove("open");
      // Count entries with this category
      const count = transactions.filter((t) => t.category === cat).length;
      showModal({
        title: "Delete Category ?",
        content: `
          <div style="color:#b45309;background:#fef3c7;padding:12px 16px;border-radius:8px;border:1px solid #fbbf24;margin-bottom:18px;display:flex;align-items:center;gap:10px;">
            <svg width="24" height="24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1"/></svg>
            <span style="font-size:1.1rem;"><b>Are you sure? This cannot be undone</b></span>
          </div>
          <div style="background:#fff;padding:18px 18px 10px 18px;border-radius:12px;border:1px solid #eee;">
            <ul style="margin:0 0 0 18px;padding:0;font-size:1.08rem;">
              <li>${count} entries in this book are tagged with this category</li>
              <li>Category will be changed for all the entries in this book which are tagged with "<b>${cat}</b>"</li>
            </ul>
          </div>
        `,
        okText: "Yes, Delete",
        cancelText: "Cancel",
        onOk: async () => {
          // Remove category and update transactions
          categories.splice(idx, 1);
          transactions.forEach((t) => {
            if (t.category === cat) t.category = "";
          });
          await saveMeta();
          await saveTransactions();
          renderCategoryDrawer();
          renderCategories();
          renderTransactions();
        },
      });
    };

    row.appendChild(chip);
    row.appendChild(menuBtn);
    row.appendChild(menu);

    chipsDiv.appendChild(row);
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
/**
 * Open the sidebar drawer with given HTML content.
 */
function openDrawer(contentHtml) {
  document.getElementById("drawer-content").innerHTML = contentHtml;
  document.getElementById("drawer-overlay").style.display = "block";
  document.getElementById("drawer-sidebar").style.display = "flex";
  document.body.classList.add("drawer-open");
  setTimeout(() => {
    document.getElementById("drawer-sidebar").classList.remove("hide");
  }, 10);
}
/**
 * Close the sidebar drawer.
 */
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
/**
 * Render the transaction drawer for add/edit.
 * @param {string} type - "income" or "expense"
 */
function renderTransactionDrawer(type = "income") {
  let html = `
    <h2 style="font-size:1.5rem;font-weight:700;color:#4338ca;margin-bottom:16px">${type === "income" ? "Add Income" : "Add Expense"}</h2>
    <form id="drawer-transaction-form" style="display:grid;gap:16px;">
      <div style="position:relative;flex:1; border-radius:8px;border:1px solid #d1d5db; overflow: hidden;">
        <input type="text" id="drawer-date" required placeholder="Select date" style="width:100%;padding:12px 44px 12px 16px;font-size:1.1rem;border-radius:0;border:none;cursor:pointer;background:#f8fafc;" readonly />
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
      <button type="button" id="drawer-save" class="btn-indigo">${type === "income" ? "Save" : "Save"}</button>
      <button type="submit" class="btn-green">${type === "income" ? "Save & Exit" : "Save & Exit"}</button>
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

  // Set default category/month if available
  if (lastEntryCategory && categories.includes(lastEntryCategory)) catSelect.value = lastEntryCategory;
  if (lastEntryMonth && months.includes(lastEntryMonth)) monthSelectEl.value = lastEntryMonth;
  else if (currentMonth) monthSelectEl.value = currentMonth;

  // Handle type switching
  const typeSelect = document.getElementById("drawer-type");
  typeSelect.value = type;

  // Form submit handler
  document.getElementById("drawer-transaction-form").onsubmit = async function (e) {
    e.preventDefault();
    await handleTransactionSave(true); // true = close drawer after save
  };
  document.getElementById("drawer-save").onclick = async function (e) {
    e.preventDefault();
    await handleTransactionSave(false); // false = keep drawer open
  };

  async function handleTransactionSave(closeAfter) {
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
    // Remember last used
    lastEntryCategory = category;
    lastEntryMonth = month;
    localStorage.setItem("lastEntryCategory", lastEntryCategory);
    localStorage.setItem("lastEntryMonth", lastEntryMonth);

    transactions.push({ date, description, amount, type: typeVal, category, month });
    await saveTransactions();
    renderTransactions();

    if (closeAfter) {
      closeDrawer();
    } else {
      // Reset only description and amount, keep others
      document.getElementById("drawer-description").value = "";
      document.getElementById("drawer-amount").value = "";
      flatpickr("#drawer-date", {
        dateFormat: "Y-m-d",
        allowInput: true,
        clickOpens: true,
        defaultDate: new Date(),
        wrap: false,
      });
      document.getElementById("drawer-description").focus();
    }
  }
}

/**
 * Open the transaction edit drawer for a given index.
 * @param {number} index
 */
function openEditDrawer(index) {
  const t = transactions[index];
  renderTransactionDrawer(t.type);
  // Fill fields
  document.getElementById("drawer-date").value = t.date;
  document.getElementById("drawer-description").value = t.description;
  document.getElementById("drawer-amount").value = t.amount;
  document.getElementById("drawer-type").value = t.type;
  document.getElementById("drawer-category").value = t.category;
  document.getElementById("drawer-month").value = t.month;

  // Override save logic
  document.getElementById("drawer-transaction-form").onsubmit = async function (e) {
    e.preventDefault();
    await handleEditSave(index, true);
  };
  document.getElementById("drawer-save").onclick = async function (e) {
    e.preventDefault();
    await handleEditSave(index, false);
  };

  async function handleEditSave(idx, closeAfter) {
    const date = document.getElementById("drawer-date").value;
    const description = document.getElementById("drawer-description").value.trim();
    const amount = parseFloat(document.getElementById("drawer-amount").value);
    const typeVal = document.getElementById("drawer-type").value;
    const category = document.getElementById("drawer-category").value;
    const month = document.getElementById("drawer-month").value;

    transactions[idx] = { ...transactions[idx], date, description, amount, type: typeVal, category, month, edited: true };
    await saveTransactions();
    renderTransactions();
    if (closeAfter) closeDrawer();
  }
}

/**
 * Open the delete modal for one or more transactions.
 * @param {number|Array} indexOrIndexes
 */
function openDeleteModal(indexOrIndexes) {
  let txnsToDelete = Array.isArray(indexOrIndexes) ? indexOrIndexes.map((i) => transactions[i]) : [transactions[indexOrIndexes]];
  let t = txnsToDelete[0];
  let isBulk = txnsToDelete.length > 1;
  let typeLabel = t.type === "income" ? "Income" : "Expense";
  let content = isBulk
    ? `<div style="color:#b45309;background:#fef3c7;padding:12px 16px;border-radius:8px;border:1px solid #fbbf24;margin-bottom:18px;">
        <b>Warning:</b> Once deleted, these entries cannot be restored.<br>Are you sure you want to delete <b>${txnsToDelete.length}</b> entries?
      </div>`
    : `<div style="color:#b45309;background:#fef3c7;padding:12px 16px;border-radius:8px;border:1px solid #fbbf24;margin-bottom:18px;">
        <b>Once deleted, this entry cannot be restored.</b><br>Are you sure you want to Delete?
      </div>
      <div style="margin-bottom:12px;font-weight:600;">Review Details</div>
      <div style="background:#f9fafb;padding:14px 18px;border-radius:10px;border:1px solid #eee;">
        <div style="display:flex;gap:24px;margin-bottom:8px;">
          <div><span style="font-weight:600;">Type</span><br>${typeLabel}</div>
          <div><span style="font-weight:600;">Amount</span><br>${t.amount.toLocaleString()}</div>
          <div><span style="font-weight:600;">Date</span><br>${t.date}</div>
        </div>
        <div><span style="font-weight:600;">Remark</span><br>${t.description}</div>
      </div>`;
  showModal({
    title: isBulk ? "Delete Entries" : "Delete Entry",
    content,
    okText: isBulk ? "Yes, Delete All" : "Yes, Delete",
    cancelText: "Cancel",
    onOk: async () => {
      if (isBulk) {
        transactions = transactions.filter((_, idx) => !indexOrIndexes.includes(idx));
      } else {
        transactions.splice(indexOrIndexes, 1);
      }
      await saveTransactions();
      selectedIndexes = [];
      renderTransactions();
      updateHeaderActions();
    },
  });
}

// --- BULK SELECTION & HEADER ACTIONS ---
let selectedIndexes = [];

/**
 * Handle selection change for transaction checkboxes.
 */
function handleSelectionChange() {
  selectedIndexes = Array.from(document.querySelectorAll(".txn-checkbox:checked")).map((cb) => parseInt(cb.getAttribute("data-index")));
  updateHeaderActions();
}

document.getElementById("select-all-txn").onchange = function () {
  const checkboxes = document.querySelectorAll(".txn-checkbox");
  checkboxes.forEach((cb) => {
    cb.checked = this.checked;
  });
  handleSelectionChange();
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
  document.getElementById("loading-indicator").style.display = "none";
  user = firebaseUser;
  const mainApp = document.getElementById("main-app");
  const loginBtn = document.getElementById("loginBtn");
  const userInfo = document.getElementById("user-info");
  if (user) {
    mainApp.style.display = "block";
    loginBtn.style.display = "none";
    userInfo.style.display = "flex";
    await loadAllData();
  } else {
    mainApp.style.display = "none";
    loginBtn.style.display = "inline-block";
    userInfo.style.display = "none";
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
