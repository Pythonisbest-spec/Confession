const STORAGE_KEY = "nhs_confessions";
const LIKED_KEY = "nhs_liked_ids";
const MAX_LENGTH = 500;

const form = document.querySelector("#confession_form");
const input = document.querySelector("#confession_input");
const errorBox = document.querySelector("#form_error");
const list = document.querySelector("#confession_list");

// ---------- Load / Save ----------

function loadConfessions() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error("Dữ liệu confession bị lỗi, đang reset:", e);
        return [];
    }
}

function saveConfessions(confessions) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(confessions));
}

function loadLikedIds() {
    const raw = localStorage.getItem(LIKED_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

function saveLikedIds(likedIds) {
    localStorage.setItem(LIKED_KEY, JSON.stringify(likedIds));
}

let confessions = loadConfessions();
let likedIds = loadLikedIds();

// ---------- Render ----------

function formatTime(timestamp) {
    const date = new Date(timestamp);
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
    item.textContent = comment.content; // textContent -> an toàn XSS
    return item;
}

function renderBox(confession) {
    // Đảm bảo dữ liệu cũ (chưa có likes/comments) vẫn chạy được
    if (typeof confession.likes !== "number") confession.likes = 0;
    if (!Array.isArray(confession.comments)) confession.comments = [];

    const box = document.createElement("div");
    box.className = "box";
    box.dataset.id = confession.id;

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
    time.textContent = formatTime(confession.createdAt);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "confession_delete";
    deleteBtn.textContent = "Xoá";
    deleteBtn.addEventListener("click", () => deleteConfession(confession.id));

    meta.appendChild(time);
    meta.appendChild(deleteBtn);

    // ----- Thả tim & nút bình luận -----
    const actions = document.createElement("div");
    actions.className = "confession_actions";

    const isLiked = likedIds.includes(confession.id);

    const heartBtn = document.createElement("button");
    heartBtn.type = "button";
    heartBtn.className = "heart_btn" + (isLiked ? " liked" : "");
    heartBtn.innerHTML = `${isLiked ? "❤️" : "🤍"} <span class="heart_count">${confession.likes}</span>`;
    heartBtn.addEventListener("click", () => toggleLike(confession.id));

    const commentToggle = document.createElement("button");
    commentToggle.type = "button";
    commentToggle.className = "comment_toggle";
    commentToggle.textContent = `💬 Bình luận (${confession.comments.length})`;

    actions.appendChild(heartBtn);
    actions.appendChild(commentToggle);

    // ----- Khu vực bình luận (ẩn mặc định) -----
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
        addComment(confession.id, text);
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
    [...confessions].reverse().forEach((c) => {
        list.appendChild(renderBox(c));
    });
}

// ---------- Actions ----------

function addConfession(content) {
    const nextNumber = confessions.length > 0
        ? confessions[confessions.length - 1].number + 1
        : 1;

    const newConfession = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        number: nextNumber,
        content,
        createdAt: Date.now(),
        likes: 0,
        comments: [],
    };

    confessions.push(newConfession);
    saveConfessions(confessions);
    renderAll();
}

function deleteConfession(id) {
    confessions = confessions.filter((c) => c.id !== id);
    saveConfessions(confessions);
    renderAll();
}

function toggleLike(id) {
    const confession = confessions.find((c) => c.id === id);
    if (!confession) return;

    const alreadyLiked = likedIds.includes(id);

    if (alreadyLiked) {
        confession.likes = Math.max(0, confession.likes - 1);
        likedIds = likedIds.filter((likedId) => likedId !== id);
    } else {
        confession.likes += 1;
        likedIds.push(id);
    }

    saveConfessions(confessions);
    saveLikedIds(likedIds);
    renderAll();
}

function addComment(confessionId, text) {
    const confession = confessions.find((c) => c.id === confessionId);
    if (!confession) return;

    confession.comments.push({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        content: text,
        createdAt: Date.now(),
    });

    saveConfessions(confessions);
    renderAll();
}

// ---------- Validation ----------

function showError(message) {
    errorBox.textContent = message;
}

function clearError() {
    errorBox.textContent = "";
}

// ---------- Events ----------

input.addEventListener("input", clearError);

form.addEventListener("submit", (event) => {
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

    addConfession(content);

    input.value = "";
    clearError();
    input.focus();
});

// ---------- Init ----------

renderAll();