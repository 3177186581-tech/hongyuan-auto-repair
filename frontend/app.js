// 宏源汽车服务管理系统 - 前端交互逻辑

const API_BASE = 'http://localhost:3000/api';
let token = localStorage.getItem('hy_token');
let currentUser = null;
let currentPayMethod = 'cash';

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        verifyToken();
    } else {
        showPage('loginPage');
    }
    // 设置默认日期
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('statsDate').value = today;
    document.getElementById('statsMonth').value = today.slice(0, 7);
    document.getElementById('paymentStartDate').value = today;
    document.getElementById('paymentEndDate').value = today;
});

function verifyToken() {
    fetch(`${API_BASE}/stats/daily`, {
        headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
        if (data.code === 401) {
            logout();
        } else {
            loadUserInfo();
            showPage('mainPage');
            loadDashboard();
        }
    }).catch(() => logout());
}

async function loadUserInfo() {
    // 从token中解析用户信息（简化处理）
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        document.getElementById('currentUser').textContent = payload.name || payload.username;
        currentUser = payload;
    } catch (e) {
        console.error('Token解析失败', e);
    }
}

// ==================== 页面切换 ====================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function switchPage(pageName, navEl) {
    document.querySelectorAll('.content-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + pageName).classList.add('active');
    if (navEl) navEl.classList.add('active');

    // 加载对应数据
    const loaders = {
        'dashboard': loadDashboard,
        'orders': loadOrders,
        'customers': loadCustomers,
        'inventory': loadInventory,
        'payments': loadPayments,
        'stats': () => { loadDailyStats(); loadMonthlyStats(); },
        'employees': loadEmployees,
        'hardware': loadHardware
    };
    if (loaders[pageName]) loaders[pageName]();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('mainContent');
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('expanded');
}

// ==================== 登录/登出 ====================
async function doLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    if (!username || !password) {
        showToast('请输入用户名和密码', 'error');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.code === 200) {
            token = data.data.token;
            localStorage.setItem('hy_token', token);
            currentUser = data.data.user;
            document.getElementById('currentUser').textContent = currentUser.name || currentUser.username;
            showPage('mainPage');
            loadDashboard();
            showToast('登录成功', 'success');
        } else {
            showToast(data.msg, 'error');
        }
    } catch (e) {
        showToast('网络错误，请检查后端是否启动', 'error');
    }
}

function doLogout() {
    logout();
    showToast('已退出登录', 'info');
}

function logout() {
    token = null;
    localStorage.removeItem('hy_token');
    document.querySelectorAll('.content-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('sidebar').classList.remove('collapsed');
    document.getElementById('mainContent').classList.remove('expanded');
    showPage('loginPage');
}

// ==================== 工作台 ====================
async function loadDashboard() {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetch(`${API_BASE}/stats/daily?date=${today}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.code === 200) {
            document.getElementById('todayRevenue').textContent = '¥' + data.data.revenue;
            document.getElementById('todayOrders').textContent = data.data.order_count;
            document.getElementById('todayCustomers').textContent = data.data.status_stats.length || 0;

            // 渲染状态统计
            const statusMap = { 'pending': '待处理', 'in_progress': '维修中', 'waiting_parts': '等配件', 'completed': '已完成', 'cancelled': '已取消' };
            const statusColors = { 'pending': 'warning', 'in_progress': 'primary', 'waiting_parts': 'orange', 'completed': 'success', 'cancelled': 'default' };
            let statusHtml = '';
            data.data.status_stats.forEach(s => {
                const dotClass = s.status;
                statusHtml += `
                    <div class="status-item">
                        <span><span class="status-dot ${dotClass}"></span>${statusMap[s.status] || s.status}</span>
                        <span class="value">${s.count}</span>
                    </div>`;
            });
            document.getElementById('orderStatusStats').innerHTML = statusHtml || '<p class="empty-state"><i class="fas fa-inbox"></i><p>暂无数据</p></p>';

            // 渲染热门项目
            let topHtml = '';
            (data.data.top_items || []).forEach(item => {
                topHtml += `
                    <div class="top-item">
                        <span class="name">${item.name}</span>
                        <span class="qty">已售${item.total_qty}</span>
                        <span class="amount">¥${item.total_amount}</span>
                    </div>`;
            });
            document.getElementById('topItems').innerHTML = topHtml || '<p class="empty-state"><i class="fas fa-chart-pie"></i><p>暂无数据</p></p>';
        }
    } catch (e) {
        console.error('加载工作台数据失败', e);
    }
    // 加载通知
    loadNotifications();
}

// ==================== 通知 ====================
async function loadNotifications() {
    try {
        const res = await fetch(`${API_BASE}/notifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.code === 200) {
            const notifs = data.data.low_stock.concat(data.data.maintenance_due);
            document.getElementById('notifBadge').textContent = notifs.length;
            document.getElementById('notifBadge').style.display = notifs.length > 0 ? 'block' : 'none';
            document.getElementById('lowStockCount').textContent = data.data.low_stock_count;

            let html = '';
            notifs.forEach(n => {
                html += `
                    <div class="notif-item unread">
                        <div class="notif-title">${n.name ? '⚠️ 低库存: ' + n.name : '🔔 保养提醒'}</div>
                        <div class="notif-content">${n.name ? '当前库存: ' + n.quantity : n.name + ' 里程已达 ' + (n.mileage || 0) + 'km'}</div>
                        <div class="notif-time">刚刚</div>
                    </div>`;
            });
            document.getElementById('notifList').innerHTML = html || '<p class="empty-state"><i class="fas fa-bell-slash"></i><p>暂无通知</p></p>';
        }
    } catch (e) {}
}

function toggleNotifications() {
    document.getElementById('notificationPanel').classList.toggle('hidden');
}

function markAllRead() {
    document.querySelectorAll('.notif-item').forEach(n => n.classList.remove('unread'));
    document.getElementById('notifBadge').style.display = 'none';
}

// ==================== 接车开单 ====================
async function loadOrders() {
    const status = document.getElementById('orderStatusFilter').value;
    const keyword = document.getElementById('orderKeyword').value;
    let url = `${API_BASE}/orders?pageSize=100`;
    if (status) url += `&status=${status}`;
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.code === 200) {
            const statusMap = { 'pending': '待处理', 'in_progress': '维修中', 'waiting_parts': '等配件', 'completed': '已完成', 'cancelled': '已取消' };
            let html = '';
            (data.data.list || []).forEach(o => {
                html += `<tr>
                    <td><strong>${o.order_no}</strong></td>
                    <td>${o.customer_name || '-'}</td>
                    <td>${o.plate_number || '-'}</td>
                    <td>${o.car_brand || ''} ${o.car_model || ''}</td>
                    <td><strong>¥${o.total_amount}</strong></td>
                    <td><span class="status-badge ${o.status}">${statusMap[o.status] || o.status}</span></td>
                    <td>${o.created_at ? new Date(o.created_at).toLocaleString('zh-CN') : '-'}</td>
                    <td>
                        ${o.status === 'completed' ? `<button class="btn-icon" onclick="openPaymentModal(${o.id}, '${o.order_no}', ${o.total_amount})" title="结算"><i class="fas fa-cash-register"></i></button>` : ''}
                        ${o.status === 'pending' ? `<button class="btn-icon" onclick="updateOrderStatus(${o.id}, 'in_progress')" title="开始维修"><i class="fas fa-play"></i></button>` : ''}
                        ${o.status === 'in_progress' ? `<button class="btn-icon" onclick="updateOrderStatus(${o.id}, 'completed')" title="完成"><i class="fas fa-check"></i></button>` : ''}
                    </td>
                </tr>`;
            });
            const tbody = document.querySelector('#ordersTable tbody');
            tbody.innerHTML = html || '<tr><td colspan="8" class="empty-state"><i class="fas fa-clipboard-list"></i><p>暂无工单</p></td></tr>';
        }
    } catch (e) {
        showToast('加载工单失败', 'error');
    }
}

async function updateOrderStatus(id, status) {
    try {
        const res = await fetch(`${API_BASE}/orders/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        showToast(data.msg, data.code === 200 ? 'success' : 'error');
        if (data.code === 200) loadOrders();
    } catch (e) {
        showToast('操作失败', 'error');
    }
}

function openOrderModal() {
    document.getElementById('orderModal').classList.remove('hidden');
    document.getElementById('orderNo').value = 'HY' + Date.now();
    loadCustomersForSelect();
    loadTechnicians();
}

function fillCustomerInfo() {
    // 这里可以从已加载的客户数据中填充
    const select = document.getElementById('orderCustomer');
    const selectedText = select.options[select.selectedIndex].text;
    // 简单解析车牌和车辆信息
    const parts = selectedText.split(' - ');
    if (parts.length > 1) {
        document.getElementById('orderPlate').value = parts[1] || '';
    }
}

async function loadCustomersForSelect() {
    try {
        const res = await fetch(`${API_BASE}/customers?pageSize=200`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        let html = '<option value="">请选择客户</option>';
        (data.data?.list || []).forEach(c => {
            html += `<option value="${c.id}">${c.name} - ${c.plate_number || '无车牌'} - ${c.phone}</option>`;
        });
        document.getElementById('orderCustomer').innerHTML = html;
    } catch (e) {}
}

async function loadTechnicians() {
    try {
        const res = await fetch(`${API_BASE}/employees`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        let html = '<option value="">请选择技师</option>';
        (data.data || []).filter(e => e.role === 'technician').forEach(e => {
            html += `<option value="${e.id}">${e.name}</option>`;
        });
        document.getElementById('orderTechnician').innerHTML = html;
    } catch (e) {}
}

function addItemRow() {
    const container = document.getElementById('orderItems');
    const row = document.createElement('div');
    row.className = 'order-item-row';
    row.innerHTML = `
        <select class="item-type">
            <option value="part">配件</option>
            <option value="labor">工时</option>
            <option value="service">服务</option>
        </select>
        <input type="text" class="item-name" placeholder="名称">
        <input type="number" class="item-qty" placeholder="数量" value="1" onchange="calcItemAmount(this)">
        <input type="number" class="item-price" placeholder="单价" onchange="calcItemAmount(this)">
        <span class="item-amount">¥0</span>
        <button class="btn-remove" onclick="removeItemRow(this)"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(row);
}

function removeItemRow(btn) {
    btn.parentElement.remove();
    calcOrderTotal();
}

function calcItemAmount(input) {
    const row = input.parentElement;
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    row.querySelector('.item-amount').textContent = '¥' + (qty * price).toFixed(0);
    calcOrderTotal();
}

function calcOrderTotal() {
    let laborTotal = 0;
    let total = 0;
    document.querySelectorAll('.order-item-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const amount = qty * price;
        if (row.querySelector('.item-type').value === 'labor') {
            laborTotal += amount;
        }
        total += amount;
    });
    document.getElementById('laborTotal').textContent = '¥' + laborTotal.toFixed(0);
    document.getElementById('orderTotal').textContent = '¥' + total.toFixed(0);
}

async function submitOrder() {
    const customer_id = document.getElementById('orderCustomer').value;
    if (!customer_id) { showToast('请选择客户', 'error'); return; }

    const items = [];
    document.querySelectorAll('.order-item-row').forEach(row => {
        const name = row.querySelector('.item-name').value;
        if (name) {
            items.push({
                type: row.querySelector('.item-type').value,
                name,
                quantity: parseInt(row.querySelector('.item-qty').value) || 1,
                unit_price: parseFloat(row.querySelector('.item-price').value) || 0,
                amount: (parseInt(row.querySelector('.item-qty').value) || 1) * (parseFloat(row.querySelector('.item-price').value) || 0)
            });
        }
    });

    if (items.length === 0) { showToast('请添加至少一个项目', 'error'); return; }

    const total_amount = items.reduce((s, i) => s + i.amount, 0);
    const labor_fee = items.filter(i => i.type === 'labor').reduce((s, i) => s + i.amount, 0);

    try {
        const res = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                customer_id: parseInt(customer_id),
                items,
                labor_fee,
                total_amount,
                remark: document.getElementById('orderRemark').value,
                mileage: parseInt(document.getElementById('orderMileage').value) || 0
            })
        });
        const data = await res.json();
        if (data.code === 200) {
            showToast('工单创建成功！', 'success');
            closeModal('orderModal');
            loadOrders();
            loadDashboard();
        } else {
            showToast(data.msg, 'error');
        }
    } catch (e) {
        showToast('提交失败', 'error');
    }
}

// ==================== 客户管理 ====================
async function loadCustomers() {
    const keyword = document.getElementById('customerKeyword').value;
    let url = `${API_BASE}/customers?pageSize=100`;
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.code === 200) {
            let html = '';
            (data.data.list || []).forEach(c => {
                html += `<tr>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.phone}</td>
                    <td><strong>${c.plate_number || '-'}</strong></td>
                    <td>${c.car_brand || ''} ${c.car_model || ''} ${c.car_year || ''}</td>
                    <td>${c.mileage || 0}</td>
                    <td>${c.created_at ? new Date(c.created_at).toLocaleDateString('zh-CN') : '-'}</td>
                    <td>
                        <button class="btn-icon" onclick="editCustomer(${c.id})" title="编辑"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon danger" onclick="deleteCustomer(${c.id})" title="删除"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            });
            document.querySelector('#customersTable tbody').innerHTML = html || '<tr><td colspan="7" class="empty-state"><i class="fas fa-users"></i><p>暂无客户</p></td></tr>';
        }
    } catch (e) {
        showToast('加载客户失败', 'error');
    }
}

function openCustomerModal() {
    document.getElementById('customerModal').classList.remove('hidden');
}

async function submitCustomer() {
    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    if (!name || !phone) { showToast('请填写姓名和手机号', 'error'); return; }

    try {
        const res = await fetch(`${API_BASE}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                name, phone,
                plate_number: document.getElementById('custPlate').value,
                car_brand: document.getElementById('custBrand').value,
                car_model: document.getElementById('custModel').value,
                car_year: document.getElementById('custYear').value,
                vin: document.getElementById('custVin').value,
                mileage: parseInt(document.getElementById('custMileage').value) || 0
            })
        });
        const data = await res.json();
        if (data.code === 200) {
            showToast('客户添加成功！', 'success');
            closeModal('customerModal');
            loadCustomers();
            // 清空表单
            document.querySelectorAll('#customerModal input, #customerModal textarea').forEach(el => el.value = '');
        } else {
            showToast(data.msg, 'error');
        }
    } catch (e) {
        showToast('添加失败', 'error');
    }
}

async function deleteCustomer(id) {
    if (!confirm('确定删除该客户？')) return;
    try {
        const res = await fetch(`${API_BASE}/customers/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        showToast(data.msg, data.code === 200 ? 'success' : 'error');
        if (data.code === 200) loadCustomers();
    } catch (e) {
        showToast('删除失败', 'error');
    }
}

// ==================== 配件库存 ====================
async function loadInventory() {
    const category = document.getElementById('inventoryCategory').value;
    const keyword = document.getElementById('inventoryKeyword').value;
    let url = `${API_BASE}/inventory?pageSize=200`;
    if (category) url += `&category=${category}`;
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.code === 200) {
            const catMap = { 'tire': '轮胎', 'battery': '电瓶', 'chassis': '底盘件', 'brake': '刹车', 'engine': '发动机', 'oil': '机油', 'filter': '滤芯', 'other': '其他' };
            let html = '';
            (data.data.list || []).forEach(item => {
                const stockClass = item.stock_status === 'low' ? 'low' : 'normal';
                const stockText = item.stock_status === 'low' ? '⚠ 库存不足' : '正常';
                html += `<tr>
                    <td>${item.code || '-'}</td>
                    <td><strong>${item.name}</strong></td>
                    <td>${catMap[item.category] || item.category}</td>
                    <td>${item.brand || '-'}</td>
                    <td>${item.spec || '-'}</td>
                    <td><strong>${item.quantity}</strong></td>
                    <td>¥${item.cost_price || '-'}</td>
                    <td><strong>¥${item.sell_price || '-'}</strong></td>
                    <td><span class="stock-badge ${stockClass}">${stockText}</span></td>
                    <td>
                        <button class="btn-icon" onclick="editInventory(${item.id})" title="编辑"><i class="fas fa-edit"></i></button>
                    </td>
                </tr>`;
            });
            document.querySelector('#inventoryTable tbody').innerHTML = html || '<tr><td colspan="10" class="empty-state"><i class="fas fa-boxes"></i><p>暂无配件</p></td></tr>';
        }
    } catch (e) {
        showToast('加载库存失败', 'error');
    }
}

function openInventoryModal() {
    document.getElementById('inventoryModal').classList.remove('hidden');
}

async function submitInventory() {
    const name = document.getElementById('invName').value.trim();
    if (!name) { showToast('请填写配件名称', 'error'); return; }
    try {
        const res = await fetch(`${API_BASE}/inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                code: document.getElementById('invCode').value,
                name,
                category: document.getElementById('invCategory').value,
                brand: document.getElementById('invBrand').value,
                spec: document.getElementById('invSpec').value,
                unit: document.getElementById('invUnit').value,
                quantity: parseInt(document.getElementById('invQty').value) || 0,
                min_quantity: parseInt(document.getElementById('invMinQty').value) || 5,
                cost_price: parseFloat(document.getElementById('invCostPrice').value) || 0,
                sell_price: parseFloat(document.getElementById('invSellPrice').value) || 0,
                supplier: document.getElementById('invSupplier').value
            })
        });
        const data = await res.json();
        if (data.code === 200) {
            showToast('配件添加成功！', 'success');
            closeModal('inventoryModal');
            loadInventory();
            // 清空
            document.querySelectorAll('#inventoryModal input').forEach(el => el.value = '');
        } else {
            showToast(data.msg, 'error');
        }
    } catch (e) {
        showToast('添加失败', 'error');
    }
}

async function openStockInModal() {
    document.getElementById('stockInModal').classList.remove('hidden');
    // 加载配件列表
    try {
        const res = await fetch(`${API_BASE}/inventory?pageSize=500`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        let html = '<option value="">请选择配件</option>';
        (data.data?.list || []).forEach(item => {
            html += `<option value="${item.id}">${item.name} (库存: ${item.quantity})</option>`;
        });
        document.getElementById('stockInItem').innerHTML = html;
    } catch (e) {}
}

async function submitStockIn() {
    const id = document.getElementById('stockInItem').value;
    const qty = parseInt(document.getElementById('stockInQty').value);
    if (!id || !qty) { showToast('请选择配件并输入数量', 'error'); return; }
    try {
        const res = await fetch(`${API_BASE}/inventory/in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id: parseInt(id), quantity: qty, remark: document.getElementById('stockInRemark').value })
        });
        const data = await res.json();
        if (data.code === 200) {
            showToast('入库成功！', 'success');
            closeModal('stockInModal');
            loadInventory();
        } else {
            showToast(data.msg, 'error');
        }
    } catch (e) {
        showToast('入库失败', 'error');
    }
}

// ==================== 收银结算 ====================
async function loadPayments() {
    const start = document.getElementById('paymentStartDate').value;
    const end = document.getElementById('paymentEndDate').value;
    let url = `${API_BASE}/payments?`;
    if (start) url += `start_date=${start}&`;
    if (end) url += `end_date=${end}&`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.code === 200) {
            const methodMap = { 'cash': '现金', 'wechat': '微信', 'alipay': '支付宝', 'bank_card': '银行卡', 'credit': '挂账' };
            let html = '';
            (data.data || []).forEach(p => {
                html += `<tr>
                    <td>${p.created_at ? new Date(p.created_at).toLocaleString('zh-CN') : '-'}</td>
                    <td><strong>${p.order_no || '-'}</strong></td>
                    <td>${p.customer_name || '-'}</td>
                    <td><strong style="color: var(--primary); font-size: 15px;">¥${p.amount}</strong></td>
                    <td><span class="status-badge completed">${methodMap[p.method] || p.method}</span></td>
                    <td>${p.remark || '-'}</td>
                </tr>`;
            });
            document.querySelector('#paymentsTable tbody').innerHTML = html || '<tr><td colspan="6" class="empty-state"><i class="fas fa-cash-register"></i><p>暂无支付记录</p></td></tr>';
        }
    } catch (e) {
        showToast('加载支付记录失败', 'error');
    }
}

function openPaymentModal(orderId, orderNo, amount) {
    document.getElementById('paymentModal').classList.remove('hidden');
    document.getElementById('paymentAmount').value = amount;
    document.getElementById('paymentOrderInfo').innerHTML = `
        <p>工单号: <strong>${orderNo}</strong></p>
        <p>结算金额: <strong>¥${amount}</strong></p>
    `;
    document.getElementById('paymentModal').dataset.orderId = orderId;
}

function selectPayMethod(el, method) {
    currentPayMethod = method;
    document.querySelectorAll('.pay-method').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
}

async function submitPayment() {
    const orderId = document.getElementById('paymentModal').dataset.orderId;
    const amount = document.getElementById('paymentAmount').value;
    if (!amount) { showToast('请输入金额', 'error'); return; }
    try {
        const res = await fetch(`${API_BASE}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                order_id: parseInt(orderId),
                amount: parseFloat(amount),
                method: currentPayMethod,
                remark: document.getElementById('paymentRemark').value
            })
        });
        const data = await res.json();
        if (data.code === 200) {
            showToast('收款成功！', 'success');
            closeModal('paymentModal');
            loadPayments();
            loadOrders();
            loadDashboard();
        } else {
            showToast(data.msg, 'error');
        }
    } catch (e) {
        showToast('收款失败', 'error');
    }
}

// ==================== 数据统计 ====================
async function loadDailyStats() {
    const date = document.getElementById('statsDate').value;
    try {
        const res = await fetch(`${API_BASE}/stats/daily?date=${date}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.code === 200) {
            const d = data.data;
            document.getElementById('statsOverview').innerHTML = `
                <div class="stat-row"><span>日期</span><span class="stat-value">${d.date}</span></div>
                <div class="stat-row"><span>营收</span><span class="stat-value">¥${d.revenue}</span></div>
                <div class="stat-row"><span>工单数</span><span class="stat-value">${d.order_count}</span></div>
            `;
        }
    } catch (e) {}
}

async function loadMonthlyStats() {
    const month = document.getElementById('statsMonth').value;
    try {
        const res = await fetch(`${API_BASE}/stats/monthly?month=${month}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.code === 200) {
            renderDailyChart(data.data.daily_revenue);
        }
    } catch (e) {}
}

function renderDailyChart(dailyData) {
    const ctx = document.getElementById('dailyChart').getContext('2d');
    if (window.dailyChart) window.dailyChart.destroy();
    window.dailyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: (dailyData || []).map(d => d.day?.slice(-2) || ''),
            datasets: [{
                label: '日营收',
                data: (dailyData || []).map(d => d.revenue),
                borderColor: '#1a73e8',
                backgroundColor: 'rgba(26, 115, 232, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => '¥' + v } }
            }
        }
    });
}

// ==================== 员工管理 ====================
async function loadEmployees() {
    try {
        const res = await fetch(`${API_BASE}/employees`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.code === 200) {
            const roleMap = { 'admin': '管理员', 'manager': '店长', 'technician': '技师', 'reception': '前台' };
            let html = '';
            (data.data || []).forEach(e => {
                html += `<tr>
                    <td>${e.username}</td>
                    <td><strong>${e.name}</strong></td>
                    <td><span class="status-badge completed">${roleMap[e.role] || e.role}</span></td>
                    <td>${e.phone || '-'}</td>
                    <td><span class="status-badge ${e.status ? 'completed' : 'cancelled'}">${e.status ? '启用' : '禁用'}</span></td>
                    <td>${e.created_at ? new Date(e.created_at).toLocaleDateString('zh-CN') : '-'}</td>
                    <td>
                        <button class="btn-icon danger" title="删除"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            });
            document.querySelector('#employeesTable tbody').innerHTML = html || '<tr><td colspan="7" class="empty-state"><i class="fas fa-user-tie"></i><p>暂无员工</p></td></tr>';
        }
    } catch (e) {
        showToast('加载员工失败', 'error');
    }
}

function openEmployeeModal() {
    document.getElementById('employeeModal').classList.remove('hidden');
}

async function submitEmployee() {
    const username = document.getElementById('empUsername').value.trim();
    const password = document.getElementById('empPassword').value.trim();
    const name = document.getElementById('empName').value.trim();
    if (!username || !password || !name) { showToast('请填写完整信息', 'error'); return; }
    try {
        const res = await fetch(`${API_BASE}/employees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                username, password, name,
                role: document.getElementById('empRole').value,
                phone: document.getElementById('empPhone').value
            })
        });
        const data = await res.json();
        if (data.code === 200) {
            showToast('员工添加成功！', 'success');
            closeModal('employeeModal');
            loadEmployees();
            document.querySelectorAll('#employeeModal input').forEach(el => el.value = '');
        } else {
            showToast(data.msg, 'error');
        }
    } catch (e) {
        showToast('添加失败', 'error');
    }
}

// ==================== 硬件对接 ====================
async function loadHardware() {
    try {
        const res = await fetch(`${API_BASE}/hardware/lift-status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.code === 200) {
            // 更新举升机状态显示
            const liftHtml = `
                <div class="lift-item">
                    <span class="lift-label">举升机 #1</span>
                    <span class="lift-state ${data.data.lift_1.status === 'idle' ? 'idle' : 'in-use'}">
                        ${data.data.lift_1.status === 'idle' ? '空闲' : '使用中'}
                    </span>
                </div>
                <div class="lift-item">
                    <span class="lift-label">举升机 #2</span>
                    <span class="lift-state ${data.data.lift_2.status === 'idle' ? 'idle' : 'in-use'}">
                        ${data.data.lift_2.status === 'idle' ? '空闲' : '使用中'}
                    </span>
                </div>
            `;
            document.getElementById('liftStatus').innerHTML = liftHtml;
        }
    } catch (e) {}
}

function refreshLiftStatus() {
    loadHardware();
    showToast('举升机状态已刷新', 'info');
}

function testPrint() {
    showToast('正在发送打印指令到小票打印机...', 'info');
    // 实际项目中这里调用后端打印接口
    setTimeout(() => {
        showToast('测试页打印成功！', 'success');
    }, 1500);
}

function saveHardwareConfig() {
    const ip = document.getElementById('printerIp').value;
    const port = document.getElementById('printerPort').value;
    localStorage.setItem('printer_config', JSON.stringify({ ip, port }));
    showToast('硬件配置已保存', 'success');
}

// ==================== 工具函数 ====================
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ESC 关闭模态框
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }
});

// 点击模态框背景关闭
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
});

// 回车登录
document.getElementById('password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doLogin();
});

console.log('%c宏源汽车服务管理系统%c v1.0.0', 'color: #1a73e8; font-size: 20px; font-weight: bold;', 'color: #5f6368; font-size: 12px;');
console.log('系统初始化完成，等待用户登录...');
