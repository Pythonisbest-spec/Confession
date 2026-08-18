const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzQW25_w_EmNgBsBR2Ud7_dj2Ev6hwjp-G3qLqLwWARGHuCFRin9MOrIeLkRkSuIc8aYg/exec";
const LIKED_KEY = "nhs_liked_ids";
const MAX_LENGTH = 500;

const form = document.querySelector("#confession_form");
const input = document.querySelector("#confession_input");
const errorBox = document.querySelector("#form_error");
const list = document.querySelector("#confession_list");

let likedIds = loadLikedIds();
let currentConfessions = [];
let openCommentRowIds = new Set();
let lastRawDataString = "";

function loadLikedIds() {
    const raw = localStorage.getItem(LIKED_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(Number).filter(n => !isNaN(n)) : [];
    } catch (e) {
        return [];
    }
}

function saveLikedIds(ids) {
    localStorage.setItem(LIKED_KEY, JSON.stringify(ids));
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
    item.textContent = typeof comment === "object" ? comment.content : comment;
    return item;
}

function updateOrRenderBox(confession) {
    const numId = Number(confession.rowId);
    let box = list.querySelector(`.box[data-id="${confession.rowId}"]`);
    const isLiked = likedIds.includes(numId);

    if (!box) {
        box = document.createElement("div");
        box.className = "box";
        box.dataset.id = confession.rowId;

        box.innerHTML = `
            <div class="confession_title">Confession #${String(confession.number).padStart(3, "0")}:</div>
            <div class="confession_content"><p></p></div>
            <div class="confession_meta"><span class="confession_time"></span></div>
            <div class="confession_actions">
                <button type="button" class="heart_btn"></button>
                <button type="button" class="comment_toggle"></button>
            </div>
            <div class="comments_section">
                <div class="comment_list"></div>
                <form class="comment_form">
                    <input type="text" class="comment_input" placeholder="Viết bình luận..." maxlength="200" />
                    <button type="submit" class="comment_submit">Gửi</button>
                </form>
            </div>
        `;

        const heartBtn = box.querySelector(".heart_btn");
        heartBtn.addEventListener("click", () => toggleLike(confession.rowId));

        const commentToggle = box.querySelector(".comment_toggle");
        const commentsSection = box.querySelector(".comments_section");

        commentToggle.addEventListener("click", () => {
            if (commentsSection.hidden) {
                commentsSection.hidden = false;
                openCommentRowIds.add(numId);
            } else {
                commentsSection.hidden = true;
                openCommentRowIds.delete(numId);
            }
        });

        const commentForm = box.querySelector(".comment_form");
        const commentInput = box.querySelector(".comment_input");
        commentForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const text = commentInput.value.trim();
            if (!text) return;
            commentInput.value = "";
            await addComment(confession.rowId, text);
        });
    }

    box.querySelector(".confession_content p").textContent = confession.content;
    box.querySelector(".confession_time").textContent = formatTime(confession.time);

    const heartBtn = box.querySelector(".heart_btn");
    heartBtn.className = "heart_btn" + (isLiked ? " liked" : "");
    heartBtn.innerHTML = `${isLiked ? "❤️" : "🤍"} <span class="heart_count">${confession.likes}</span>`;

    const commentToggle = box.querySelector(".comment_toggle");
    commentToggle.textContent = `💬 Bình luận (${confession.comments.length})`;

    const commentsSection = box.querySelector(".comments_section");
    commentsSection.hidden = !openCommentRowIds.has(numId);

    const commentList = box.querySelector(".comment_list");
    commentList.innerHTML = "";
    confession.comments.forEach((c) => {
        commentList.appendChild(renderComment(c));
    });

    return box;
}

function renderAll() {
    if (currentConfessions.length === 0) {
        list.innerHTML = "<p>Chưa có confession nào được duyệt.</p>";
        return;
    }

    const emptyMsg = list.querySelector("p");
    if (emptyMsg && emptyMsg.textContent.includes("Chưa có confession")) {
        list.innerHTML = "";
    }

    [...currentConfessions].reverse().forEach((c) => {
        const box = updateOrRenderBox(c);
        if (!box.parentNode) {
            list.appendChild(box);
        }
    });
}

async function loadApprovedConfessions() {
    try {
        const response = await fetch(SCRIPT_URL + "?t=" + Date.now());
        const data = await response.json();
        const rawString = JSON.stringify(data);

        if (rawString === lastRawDataString) return;
        lastRawDataString = rawString;

        currentConfessions = data.map((item, index) => {
            const numId = Number(item.rowId);
            const existing = currentConfessions.find(c => Number(c.rowId) === numId);
            const serverLikes = Number(item.likes) || 0;
            const likes = existing ? Math.max(existing.likes, serverLikes) : serverLikes;

            return {
                rowId: item.rowId,
                number: index + 1,
                content: item.content,
                time: item.time,
                likes: likes,
                comments: item.comments || []
            };
        });

        renderAll();
    } catch (err) {
        console.error("Lỗi tải confession:", err);
    }
}

async function toggleLike(rowId) {
    const numId = Number(rowId);
    if (likedIds.includes(numId)) return;

    likedIds.push(numId);
    saveLikedIds(likedIds);

    const confession = currentConfessions.find(c => Number(c.rowId) === numId);
    if (confession) {
        confession.likes = (confession.likes || 0) + 1;
        renderAll();
    }

    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "like", rowId: numId })
        });
    } catch (err) {
        console.error("Lỗi tim:", err);
    }
}

async function addComment(rowId, text) {
    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "comment", rowId: Number(rowId), content: text })
        });
        lastRawDataString = "";
        await loadApprovedConfessions();
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

if (form) {
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
                mode: "no-cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "confession", content: content })
            });
            alert("Đã gửi confession thành công! Vui lòng chờ admin duyệt.");
            input.value = "";
            clearError();
        } catch (err) {
            console.error("Lỗi gửi confession:", err);
            alert("Có lỗi xảy ra, vui lòng thử lại!");
        }
    });
}

loadApprovedConfessions();
setInterval(loadApprovedConfessions, 5000);