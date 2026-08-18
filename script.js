const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby40A3Y3AJq5d7CNI-9fGoJxzULYgak4yuPY1GEol_djAQdQkFT_JoQpHmyLViyp91UJw/exec";
const LIKED_KEY = "nhs_liked_ids";
const MAX_LENGTH = 500;

const form = document.querySelector("#confession_form");
const input = document.querySelector("#confession_input");
const errorBox = document.querySelector("#form_error");
const list = document.querySelector("#confession_list");

let likedIds = loadLikedIds();
let currentConfessions = [];

function loadLikedIds() {
    const raw = localStorage.getItem(LIKED_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (e) { return []; }
}

function saveLikedIds(likedIds) {
    localStorage.setItem(LIKED_KEY, JSON.stringify(likedIds));
}

function formatTime(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    return date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function renderComment(comment) {
    const item = document.createElement("div");
    item.className = "comment_item";
    item.textContent = comment.content;
    return item;
}

function renderBox(confession) {
    const box = document.createElement("div");
    box.className = "box";
    box.dataset.id = confession.rowId;

    const title = document.createElement("div");
    title.className = "confession_title";
    title.textContent = `Confession #${String(confession.number).padStart(3, "0")}:`;

    const contentDiv = document.createElement("div");
    contentDiv.className = "confession_content";
    const p = document.createElement("p");
    p.textContent = confession.content;
    contentDiv.appendChild(p);

    const meta = document.createElement("div");
    meta.className = "confession_meta";

    const time = document.createElement("span");
    time.className = "confession_time";
    time.textContent = formatTime(confession.time);
    meta.appendChild(time);

    const actions = document.createElement("div");
    actions.className = "confession_actions";

    const isLiked = likedIds.includes(confession.rowId);

    const heartBtn = document.createElement("button");
    heartBtn.type = "button";
    heartBtn.className = "heart_btn" + (isLiked ? " liked" : "");
    heartBtn.innerHTML = `${isLiked ? "❤️" : "🤍"} <span class="heart_count">${confession.likes}</span>`;
    heartBtn.addEventListener("click", () => toggleLike(confession.rowId));

    const commentToggle = document.createElement("button");
    commentToggle.type = "button";
    commentToggle.className = "comment_toggle";
    commentToggle.textContent = `💬 Bình luận (${confession.comments.length})`;

    actions.appendChild(heartBtn);
    actions.appendChild(commentToggle);

    const commentsSection = document.createElement("div");
    commentsSection.className = "comments_section";
    commentsSection.hidden = true;

    const commentList = document.createElement("div");
    commentList.className = "comment_list";
    confession.comments.forEach((c) => {
        commentList.appendChild(renderComment(c));
    });

    const commentForm = document.createElement("form");
    commentForm.className = "comment_form";

    const commentInput = document.createElement("input");
    commentInput.className = "comment_input";
    commentInput.placeholder = "Viết bình luận...";
    commentInput.maxLength = 200;

    const commentSubmit = document.createElement("button");
    commentSubmit.type = "submit";
    commentSubmit.className = "comment_submit";
    commentSubmit.textContent = "Gửi";

    commentForm.appendChild(commentInput);
    commentForm.appendChild(commentSubmit);

    commentForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = commentInput.value.trim();
        if (text === "") return;
        addComment(confession.rowId, text);
    });

    commentsSection.appendChild(commentList);
    commentsSection.appendChild(commentForm);

    commentToggle.addEventListener("click", () => {
        commentsSection.hidden = !commentsSection.hidden;
    });

    box.appendChild(title);
    box.appendChild(contentDiv);
    box.appendChild(meta);
    box.appendChild(actions);
    box.appendChild(commentsSection);

    return box;
}

function renderAll() {
    list.innerHTML = "";
    if (currentConfessions.length === 0) {
        list.innerHTML = "<p>Chưa có confession nào được duyệt.</p>";
        return;
    }

    [...currentConfessions].reverse().forEach((c) => {
        list.appendChild(renderBox(c));
    });
}

async function loadApprovedConfessions() {
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();

        currentConfessions = data.map((item, index) => ({
            rowId: item.rowId,
            number: index + 1,
            content: item.content,
            time: item.time,
            likes: item.likes || 0,
            comments: item.comments || []
        }));

        renderAll();
    } catch (err) {
        console.error("Lỗi tải confession:", err);
        list.innerHTML = "<p>Không thể tải danh sách confession. Vui lòng thử lại sau.</p>";
    }
}

async function toggleLike(rowId) {
    if (likedIds.includes(rowId)) return;

    likedIds.push(rowId);
    saveLikedIds(likedIds);

    const confession = currentConfessions.find(c => c.rowId === rowId);
    if (confession) {
        confession.likes += 1;
        renderAll();
    }

    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({ action: "like", rowId: rowId })
        });
    } catch (err) {
        console.error("Lỗi tim:", err);
    }
}

async function addComment(rowId, text) {
    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({ action: "comment", rowId: rowId, content: text })
        });
        loadApprovedConfessions();
    } catch (err) {
        console.error("Lỗi bình luận:", err);
        alert("Không thể gửi bình luận, vui lòng thử lại!");
    }
}

function showError(message) {
    if (errorBox) errorBox.textContent = message;
}

function clearError() {
    if (errorBox) errorBox.textContent = "";
}

if (input) {
    input.addEventListener("input", clearError);
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = input.value.trim();

    if (content === "") {
        showError("Bạn chưa nhập nội dung confession.");
        return;
    }

    if (content.length > MAX_LENGTH) {
        showError(`Confession quá dài, tối đa ${MAX_LENGTH} ký tự.`);
        return;
    }

    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({ content: content })
        });
        alert("Đã gửi confession thành công! Vui lòng chờ admin duyệt.");
        input.value = "";
        clearError();
    } catch (err) {
        console.error("Lỗi gửi confession:", err);
        alert("Có lỗi xảy ra, vui lòng thử lại!");
    }
});

loadApprovedConfessions();