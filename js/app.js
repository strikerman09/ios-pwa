"use strict";

/* =====================================================
ELEMENTS
===================================================== */

const homeBtn =
document.getElementById("homeBtn");

const upBtn =
document.getElementById("upBtn");

const newFolderBtn =
document.getElementById("newFolderBtn");

const uploadBtn =
document.getElementById("uploadBtn");

const uploadFolderBtn =
document.getElementById("uploadFolderBtn");

const reorderBtn =
document.getElementById("reorderBtn");

const refreshBtn =
document.getElementById("refreshBtn");

const favoritesBtn =
document.getElementById("favoritesBtn");

const recentBtn =
document.getElementById("recentBtn");

const searchBox =
document.getElementById("searchBox");

const breadcrumb =
document.getElementById("breadcrumb");

const message =
document.getElementById("message");

const fileList =
document.getElementById("fileList");

const fileInput =
document.getElementById("fileInput");

const folderInput =
document.getElementById("folderInput");

const uploadStatus =
document.getElementById("uploadStatus");

const reorderBar =
document.getElementById("reorderBar");

const saveOrderBtn =
document.getElementById("saveOrderBtn");

const cancelOrderBtn =
document.getElementById("cancelOrderBtn");

/* =====================================================
DATABASE
===================================================== */

const DB_NAME =
"MobileFileManagerV2";

const DB_VERSION =
1;

const STORE_NAME =
"items";

let db = null;

/* =====================================================
CURRENT LOCATION
===================================================== */

let currentFolderId =
"root";

let folderStack = [
{
id: "root",
name: "မူလ"
}
];

/* =====================================================
REORDER
===================================================== */

let reorderMode =
false;

let originalOrder =
[];

let workingOrder =
[];

/* =====================================================
SEARCH
===================================================== */

let searchTimer =
null;

/* =====================================================
ID
===================================================== */

function makeId() {


return (
    Date.now().toString(36) +
    "-" +
    Math.random()
        .toString(36)
        .slice(2)
);


}

/* =====================================================
OPEN DATABASE
===================================================== */

function openDB() {


return new Promise(
    (resolve, reject) => {

        const request =
            indexedDB.open(
                DB_NAME,
                DB_VERSION
            );


        request.onupgradeneeded =
            event => {

                const database =
                    event.target.result;


                if (
                    !database.objectStoreNames
                        .contains(STORE_NAME)
                ) {

                    const store =
                        database.createObjectStore(
                            STORE_NAME,
                            {
                                keyPath: "id"
                            }
                        );


                    store.createIndex(
                        "parentId",
                        "parentId",
                        {
                            unique: false
                        }
                    );

                }

            };


        request.onsuccess =
            () => {

                db =
                    request.result;

                resolve(db);

            };


        request.onerror =
            () => {

                reject(
                    request.error
                );

            };

    }
);


}

/* =====================================================
STORE
===================================================== */

function getStore(
mode = "readonly"
) {


return db
    .transaction(
        STORE_NAME,
        mode
    )
    .objectStore(
        STORE_NAME
    );


}

/* =====================================================
ADD
===================================================== */

function addItem(item) {


return new Promise(
    (resolve, reject) => {

        const request =
            getStore(
                "readwrite"
            ).add(item);


        request.onsuccess =
            () => resolve(item);


        request.onerror =
            () =>
                reject(
                    request.error
                );

    }
);


}

/* =====================================================
UPDATE
===================================================== */

function updateItem(item) {


return new Promise(
    (resolve, reject) => {

        const request =
            getStore(
                "readwrite"
            ).put(item);


        request.onsuccess =
            () => resolve(item);


        request.onerror =
            () =>
                reject(
                    request.error
                );

    }
);


}

/* =====================================================
FAVORITE
===================================================== */

async function toggleFavorite(item) {


item.favorite =
    item.favorite === true
        ? false
        : true;

await updateItem(item);

await displayCurrentFolder();


}

/* =====================================================
GET
===================================================== */

function getItem(id) {


return new Promise(
    (resolve, reject) => {

        const request =
            getStore().get(id);


        request.onsuccess =
            () =>
                resolve(
                    request.result ||
                    null
                );


        request.onerror =
            () =>
                reject(
                    request.error
                );

    }
);


}

/* =====================================================
GET ALL
===================================================== */

function getAllItems() {


return new Promise(
    (resolve, reject) => {

        const request =
            getStore().getAll();


        request.onsuccess =
            () =>
                resolve(
                    request.result
                );


        request.onerror =
            () =>
                reject(
                    request.error
                );

    }
);


}

/* =====================================================
DELETE
===================================================== */

function deleteItem(id) {


return new Promise(
    (resolve, reject) => {

        const request =
            getStore(
                "readwrite"
            ).delete(id);


        request.onsuccess =
            () => resolve();


        request.onerror =
            () =>
                reject(
                    request.error
                );

    }
);


}

/* =====================================================
ROOT
===================================================== */

async function createRootIfNeeded() {


const root =
    await getItem("root");


if (!root) {

    await addItem({

        id: "root",

        parentId: null,

        type: "folder",

        name: "မူလ",

        position: 0,

        createdAt: Date.now()

    });

}


}

/* =====================================================
   REBUILD OLD PDF SEARCH INDEX
===================================================== */

async function rebuildOldPdfSearchIndex() {

    if (!window.pdfjsLib) {

        console.warn(
            "PDF.js is not loaded. Old PDF indexing skipped."
        );

        return;

    }

    const allItems =
        await getAllItems();

    const oldPdfs =
        allItems.filter(
            item =>
                item.type === "file" &&
                (
                    item.name ||
                    ""
                ).toLowerCase().endsWith(".pdf") &&
                !(
                    item.searchText &&
                    item.searchText.trim()
                )
        );

    if (!oldPdfs.length) {

        return;

    }

    console.log(
        "Old PDFs to index:",
        oldPdfs.length
    );

    let processed = 0;

    for (const item of oldPdfs) {

        try {

            if (!item.blob) {
                continue;
            }

            const blob =
                item.blob instanceof Blob
                    ? item.blob
                    : new Blob(
                        [item.blob],
                        {
                            type:
                                item.mime ||
                                "application/pdf"
                        }
                    );

            const arrayBuffer =
                await blob.arrayBuffer();

            const pdf =
                await window.pdfjsLib.getDocument({
                    data: arrayBuffer
                }).promise;

            let text = "";

            for (
                let pageNumber = 1;
                pageNumber <= pdf.numPages;
                pageNumber++
            ) {

                const page =
                    await pdf.getPage(
                        pageNumber
                    );

                const content =
                    await page.getTextContent();

                const pageText =
                    content.items
                        .map(
                            item =>
                                item.str || ""
                        )
                        .join(" ");

                text +=
                    pageText +
                    "\n";
            }

            item.searchText =
                text
                    .replace(/\s+/g, " ")
                    .trim();

            await updateItem(item);

            processed++;

            console.log(
                `PDF indexed ${processed}/${oldPdfs.length}:`,
                item.name
            );

        } catch (error) {

            console.error(
                "Old PDF indexing failed:",
                item.name,
                error
            );

        }

    }

    console.log(
        "Old PDF search indexing completed:",
        processed,
        "/",
        oldPdfs.length
    );

}

/* =====================================================
INITIALIZE
===================================================== */

async function initialize() {

    try {

        await openDB();

        await createRootIfNeeded();

        await rebuildOldPdfSearchIndex();

        renderBreadcrumb();

        await displayCurrentFolder();

        message.textContent =
            "Mobile V4 အသင့်ဖြစ်ပါပြီ။";

    } catch (error) {

    console.error(error);

    message.textContent =
        "Database ဖွင့်၍ မရပါ။";

}


}

/* =====================================================
CHILDREN
===================================================== */

async function getChildren(
parentId
) {


const items =
    await getAllItems();


return items.filter(
    item =>
        item.parentId ===
        parentId
);


}

/* =====================================================
SORT
===================================================== */

function sortItems(items) {


return [...items].sort(
    (a, b) => {

        if (
            a.position !==
            b.position
        ) {

            return (
                a.position -
                b.position
            );

        }

        return a.name.localeCompare(
            b.name,
            "my"
        );

    }
);


}

/* =====================================================
NEXT POSITION
===================================================== */

async function getNextPosition(
parentId
) {


const children =
    await getChildren(
        parentId
    );


if (!children.length) {

    return 0;

}


return (
    Math.max(
        ...children.map(
            item =>
                Number(
                    item.position
                ) || 0
        )
    ) + 1
);


}

/* =====================================================
DISPLAY
===================================================== */

async function displayCurrentFolder() {


if (reorderMode) {
    return;
}


fileList.innerHTML =
    "";


renderBreadcrumb();


const children =
    await getChildren(
        currentFolderId
    );


const sorted =
    sortItems(children);


if (!sorted.length) {

    showEmpty();

    message.textContent =
        "ဤဖိုင်တွဲအတွင်း ဘာမျှမရှိပါ။";

    updateNavigation();

    return;

}


sorted.forEach(
    (item, index) => {

        createFileItem(
            item,
            index + 1
        );

    }
);


message.textContent =
    toMyanmarNumber(
        sorted.length
    ) +
    " ခု";


updateNavigation();


}

/* =====================================================
CREATE FILE ITEM
===================================================== */

function createFileItem(
item,
position
) {


const row =
    document.createElement(
        "div"
    );


row.className =
    "file-item";


if (
    item.type === "folder"
) {

    row.classList.add(
        "folder-row"
    );

}


const number =
    document.createElement(
        "div"
    );


number.className =
    "position";


number.textContent =
    toMyanmarNumber(
        position
    );


row.appendChild(number);


const icon =
    document.createElement(
        "div"
    );


icon.className =
    "file-icon";


icon.textContent =
    item.type === "folder"
        ? "📁"
        : getIcon(item.name);


row.appendChild(icon);


const info =
    document.createElement(
        "div"
    );


info.className =
    "file-info";


const name =
    document.createElement(
        "div"
    );


name.className =
    "file-name";


const nameText =
    document.createElement(
        "span"
    );


nameText.className =
    "file-name-text";


nameText.textContent =
    item.name;


name.appendChild(
    nameText
);


info.appendChild(
    name
);


const type =
    document.createElement(
        "div"
    );


type.className =
    "file-type";


type.textContent =
    item.type === "folder"
        ? "ဖိုင်တွဲ"
        : getFileType(item.name);


info.appendChild(
    type
);


row.appendChild(
    info
);


const actions =
    document.createElement(
        "div"
    );


actions.className =
    "item-actions";


/* =================================================
   DETAILS
================================================= */

const detailsBtn =
    document.createElement(
        "button"
    );


detailsBtn.className =
    "item-btn";


detailsBtn.type =
    "button";


detailsBtn.textContent =
    "ⓘ";


detailsBtn.setAttribute(
    "aria-label",
    "Details"
);


detailsBtn.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        showFileDetails(
            item
        );

    }
);


actions.appendChild(
    detailsBtn
);


/* =================================================
   FAVORITE
================================================= */

const favoriteBtn =
    document.createElement(
        "button"
    );


favoriteBtn.type =
    "button";


favoriteBtn.textContent =
    item.favorite === true
        ? "⭐"
        : "☆";


favoriteBtn.style.display =
    "inline-flex";


favoriteBtn.style.width =
    "40px";


favoriteBtn.style.height =
    "40px";


favoriteBtn.style.alignItems =
    "center";


favoriteBtn.style.justifyContent =
    "center";


favoriteBtn.style.fontSize =
    "22px";


favoriteBtn.style.border =
    "none";


favoriteBtn.style.background =
    "transparent";


favoriteBtn.style.cursor =
    "pointer";


favoriteBtn.setAttribute(
    "aria-label",
    "Add Favorite"
);


favoriteBtn.addEventListener(
    "click",
    async event => {

        event.stopPropagation();

        await toggleFavorite(
            item
        );

    }
);


actions.appendChild(
    favoriteBtn
);


/* =================================================
   MORE
================================================= */
    const moreBtn =
    document.createElement(
        "button"
    );

moreBtn.className =
    "item-btn item-more-btn";

moreBtn.type =
    "button";

moreBtn.setAttribute(
    "aria-label",
    "More"
);

moreBtn.innerHTML =
    "<span>•••</span>";

actions.appendChild(
    moreBtn
);

const openMoreMenu =
    event => {

        event.preventDefault();

        event.stopPropagation();

        openItemActionMenu(
            item.id,
            event.currentTarget
        );

        return false;

    };

moreBtn.addEventListener(
    "click",
    openMoreMenu
);


/* =================================================
   RENAME
================================================= */

const renameBtn =
    document.createElement(
        "button"
    );


renameBtn.className =
    "item-btn";


renameBtn.type =
    "button";


renameBtn.textContent =
    "✏️";


renameBtn.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        renameItem(
            item
        );

    }
);


actions.appendChild(
    renameBtn
);


/* =================================================
   DELETE
================================================= */

const deleteBtn =
    document.createElement(
        "button"
    );


deleteBtn.className =
    "item-btn";


deleteBtn.type =
    "button";


deleteBtn.textContent =
    "🗑️";


deleteBtn.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        deleteItemAndChildren(
            item
        );

    }
);


actions.appendChild(
    deleteBtn
);


row.appendChild(
    actions
);


row.addEventListener(
    "click",
    () => {

        if (
            item.type ===
            "folder"
        ) {

            openFolder(
                item
            );

        } else {

            openFile(
                item
            );

        }

    }
);


attachLongPress(
    row,
    item
);


fileList.appendChild(
    row
);


requestAnimationFrame(
    () => {

        if (
            window.innerWidth <=
            600 &&
            nameText.scrollWidth >
            name.clientWidth
        ) {

            const distance =
                nameText.scrollWidth -
                name.clientWidth;


            name.style.setProperty(
                "--marquee-distance",
                "-" +
                distance +
                "px"
            );


            name.classList.add(
                "marquee"
            );

        }

    }
);


}

/* =====================================================
OPEN FOLDER
===================================================== */

async function openFolder(
folder
) {


if (reorderMode) {
    return;
}


currentFolderId =
    folder.id;


folderStack.push({

    id:
        folder.id,

    name:
        folder.name

});


await displayCurrentFolder();


}

/* =====================================================
HOME
===================================================== */

homeBtn.addEventListener(
"click",
async () => {


    if (reorderMode) {
        return;
    }


    currentFolderId =
        "root";


    folderStack = [
        {
            id: "root",
            name: "မူလ"
        }
    ];


    searchBox.value =
        "";


    await displayCurrentFolder();

}


);

/* =====================================================
FAVORITES
===================================================== */

if (favoritesBtn) {


favoritesBtn.addEventListener(
    "click",
    () => {

        displayFavorites();

    }
);


}

/* =====================================================
RECENT
===================================================== */

if (recentBtn) {


recentBtn.addEventListener(
    "click",
    () => {

        displayRecentDocuments();

    }
);


}

/* =====================================================
UP
===================================================== */

upBtn.addEventListener(
"click",
async () => {


    if (reorderMode) {
        return;
    }


    if (
        folderStack.length <= 1
    ) {
        return;
    }


    folderStack.pop();


    const parent =
        folderStack[
            folderStack.length - 1
        ];


    currentFolderId =
        parent.id;


    await displayCurrentFolder();

}


);

/* =====================================================
NAVIGATION
===================================================== */

function updateNavigation() {


upBtn.disabled =
    folderStack.length <= 1;


}

/* =====================================================
BREADCRUMB
===================================================== */

function renderBreadcrumb() {


breadcrumb.innerHTML =
    "";


folderStack.forEach(
    (folder, index) => {

        if (index > 0) {

            const separator =
                document.createElement(
                    "span"
                );


            separator.textContent =
                " / ";


            breadcrumb.appendChild(
                separator
            );

        }


        const button =
            document.createElement(
                "button"
            );


        button.className =
            "crumb";


        if (
            index ===
            folderStack.length - 1
        ) {

            button.classList.add(
                "current"
            );

        }


        button.type =
            "button";


        button.textContent =
            index === 0
                ? "🏠 မူလ"
                : folder.name;


        button.addEventListener(
            "click",
            async () => {

                if (reorderMode) {
                    return;
                }


                folderStack =
                    folderStack.slice(
                        0,
                        index + 1
                    );


                currentFolderId =
                    folderStack[
                        folderStack.length - 1
                    ].id;


                await displayCurrentFolder();

            }
        );


        breadcrumb.appendChild(
            button
        );

    }
);


}

/* =====================================================
NEW FOLDER
===================================================== */

newFolderBtn.addEventListener(
"click",
async () => {


    if (reorderMode) {
        return;
    }


    const input =
        prompt(
            "ဖိုင်တွဲအမည် ထည့်ပါ:"
        );


    if (input === null) {
        return;
    }


    const name =
        input.trim();


    if (!name) {
        return;
    }


    if (
        name.includes("/") ||
        name.includes("\\")
    ) {

        alert(
            "/ နှင့် \\ မသုံးရပါ။"
        );

        return;

    }


    const children =
        await getChildren(
            currentFolderId
        );


    const duplicate =
        children.some(
            item =>
                item.name
                    .toLowerCase() ===
                name.toLowerCase()
        );


    if (duplicate) {

        alert(
            "ဤအမည်ရှိ ဖိုင် သို့မဟုတ် ဖိုင်တွဲ ရှိပြီးသားဖြစ်သည်။"
        );

        return;

    }


    const position =
        await getNextPosition(
            currentFolderId
        );


    await addItem({

        id:
            makeId(),

        parentId:
            currentFolderId,

        type:
            "folder",

        name:
            name,

        position:
            position,

        createdAt:
            Date.now()

    });


    await displayCurrentFolder();

}


);

/* =====================================================
NORMAL FILE UPLOAD
===================================================== */

uploadBtn.addEventListener(
"click",
() => {


    if (reorderMode) {
        return;
    }


    fileInput.click();

}


);

fileInput.addEventListener(
"change",
async () => {


    const files =
        Array.from(
            fileInput.files || []
        );


    if (!files.length) {
        return;
    }


    try {

        showUploadStatus(
            "ဖိုင်များ သိမ်းနေပါသည်..."
        );


        let count = 0;


        for (
            const file of files
        ) {

            await saveUploadedFile(
                file,
                currentFolderId
            );


            count++;


            showUploadStatus(
                `${count} / ${files.length} ဖိုင် သိမ်းနေပါသည်...`
            );

        }


        fileInput.value =
            "";


        hideUploadStatus();


        await displayCurrentFolder();


        message.textContent =
            toMyanmarNumber(
                count
            ) +
            " ဖိုင် တင်ပြီးပါပြီ။";


    } catch (error) {

        hideUploadStatus();

        console.error(error);

        alert(
            "ဖိုင်တင်၍ မရပါ။\n\n" +
            error.message
        );

    }

}


);

/* =====================================================
   EXTRACT PDF SEARCH TEXT
===================================================== */

async function extractPdfSearchText(file) {

    if (
        !file ||
        !file.name.toLowerCase().endsWith(".pdf")
    ) {

        return "";

    }


    if (
        !window.pdfjsLib
    ) {

        console.warn(
            "PDF.js is not loaded."
        );

        return "";

    }


    try {

        const arrayBuffer =
            await file.arrayBuffer();


        const pdf =
            await window.pdfjsLib.getDocument({
                data: arrayBuffer
            }).promise;


        let text = "";


        for (
            let pageNumber = 1;
            pageNumber <= pdf.numPages;
            pageNumber++
        ) {

            const page =
                await pdf.getPage(
                    pageNumber
                );


            const content =
                await page.getTextContent();


            const pageText =
                content.items
                    .map(
                        item =>
                            item.str || ""
                    )
                    .join(" ");


            text +=
                pageText +
                "\n";

        }


        return text
            .replace(/\s+/g, " ")
            .trim();


    } catch (error) {

        console.error(
            "PDF text extraction failed:",
            error
        );

        return "";

    }

}

/* =====================================================
SAVE FILE
===================================================== */

async function saveUploadedFile(
file,
parentId
) {


const children =
    await getChildren(
        parentId
    );


const existing =
    children.find(
        item =>
            item.name ===
            file.name
    );


if (existing) {

    const overwrite =
        confirm(
            `"${file.name}" ရှိပြီးသားဖြစ်သည်။ အစားထိုးမလား?`
        );


    if (!overwrite) {
        return;
    }


    await deleteItemAndChildren(
        existing,
        false
    );

}


const position =
    await getNextPosition(
        parentId
    );


const searchText =
    await extractPdfSearchText(
        file
    );


await addItem({

    id:
        makeId(),

    parentId:
        parentId,

    type:
        "file",

    name:
        file.name,

    mime:
        file.type ||
        "application/octet-stream",

    size:
        file.size,

    blob:
        file,

    searchText:
        searchText,

    position:
        position,

    createdAt:
        Date.now()

});


}

/* =====================================================
FOLDER UPLOAD
===================================================== */

uploadFolderBtn.addEventListener(
"click",
() => {


    if (reorderMode) {
        return;
    }


    folderInput.click();

}


);

/* =====================================================
FOLDER INPUT
===================================================== */

folderInput.addEventListener(
"change",
async () => {


    const files =
        Array.from(
            folderInput.files || []
        );


    if (!files.length) {
        return;
    }


    try {

        await uploadWholeFolder(
            files
        );


    } catch (error) {

        console.error(
            "Folder upload failed:",
            error
        );


        alert(
            "Folder တင်၍ မရပါ။\n\n" +
            error.message
        );

    }


    folderInput.value =
        "";

}


);

/* =====================================================
UPLOAD WHOLE FOLDER
===================================================== */

async function uploadWholeFolder(
files
) {


showUploadStatus(
    "Folder ကို ဖတ်နေပါသည်..."
);


const firstPath =
    files[0].webkitRelativePath ||
    files[0].name;


const rootFolderName =
    firstPath.split("/")[0];


const hasPaths =
    files.some(
        file =>
            !!file.webkitRelativePath
    );


if (!hasPaths) {

    let count = 0;


    for (
        const file of files
    ) {

        await saveUploadedFile(
            file,
            currentFolderId
        );


        count++;


        showUploadStatus(
            `${count} / ${files.length} ဖိုင်`
        );

    }


    hideUploadStatus();


    await displayCurrentFolder();


    message.textContent =
        "ဖိုင်များ တင်ပြီးပါပြီ။";


    return;

}


const rootFolder =
    await getOrCreateFolder(
        currentFolderId,
        rootFolderName
    );


let processed =
    0;


for (
    const file of files
) {

    const relativePath =
        file.webkitRelativePath;


    const parts =
        relativePath.split("/");


    parts.shift();


    parts.pop();


    let parentId =
        rootFolder.id;


    for (
        const folderName of parts
    ) {

        if (!folderName) {
            continue;
        }


        const folder =
            await getOrCreateFolder(
                parentId,
                folderName
            );


        parentId =
            folder.id;

    }


    await saveUploadedFile(
        file,
        parentId
    );


    processed++;


    showUploadStatus(
        `${processed} / ${files.length} ဖိုင် သိမ်းနေပါသည်...`
    );

}


hideUploadStatus();


await displayCurrentFolder();


message.textContent =
    `📂 ${rootFolderName} Folder ကို ` +
    `${toMyanmarNumber(processed)} ဖိုင်နှင့်အတူ တင်ပြီးပါပြီ။`;


}

/* =====================================================
GET OR CREATE FOLDER
===================================================== */

async function getOrCreateFolder(
parentId,
name
) {


const children =
    await getChildren(
        parentId
    );


const existing =
    children.find(
        item =>
            item.type === "folder" &&
            item.name === name
    );


if (existing) {

    return existing;

}


const position =
    await getNextPosition(
        parentId
    );


const folder = {

    id:
        makeId(),

    parentId:
        parentId,

    type:
        "folder",

    name:
        name,

    position:
        position,

    createdAt:
        Date.now()

};


await addItem(
    folder
);


return folder;


}

/* =====================================================
UPLOAD STATUS
===================================================== */

function showUploadStatus(
text
) {


uploadStatus.style.display =
    "block";


uploadStatus.textContent =
    "⏳ " + text;


}

function hideUploadStatus() {


uploadStatus.style.display =
    "none";


}

/* =====================================================
OPEN FILE
===================================================== */

async function openFile(
item
) {


try {

    item.lastOpened =
        Date.now();


    await updateItem(
        item
    );


    if (!item.blob) {

        alert(
            "ဤဖိုင်၏ data မတွေ့ပါ။"
        );

        return;

    }


    const blob =
        item.blob instanceof Blob
            ? item.blob
            : new Blob(
                [item.blob],
                {
                    type:
                        item.mime ||
                        "application/octet-stream"
                }
            );


    const url =
        URL.createObjectURL(
            blob
        );


    const newWindow =
        window.open(
            url,
            "_blank"
        );


    if (!newWindow) {

        const link =
            document.createElement(
                "a"
            );


        link.href =
            url;


        link.download =
            item.name;


        link.textContent =
            "ဖိုင်ဖွင့်ရန် ဒီနေရာကိုနှိပ်ပါ";


        link.style.position =
            "fixed";


        link.style.left =
            "20px";


        link.style.right =
            "20px";


        link.style.bottom =
            "20px";


        link.style.padding =
            "16px";


        link.style.background =
            "#111827";


        link.style.color =
            "white";


        link.style.textAlign =
            "center";


        link.style.borderRadius =
            "10px";


        link.style.zIndex =
            "9999";


        document.body.appendChild(
            link
        );


        setTimeout(
            () => {

                if (
                    link.parentNode
                ) {

                    link.remove();

                }

            },
            15000
        );

    }


    setTimeout(
        () => {

            URL.revokeObjectURL(
                url
            );

        },
        60000
    );


} catch (error) {

    console.error(error);

    alert(
        "ဖိုင်ဖွင့်၍ မရပါ။\n\n" +
        error.message
    );

}


}

/* =====================================================
RENAME
===================================================== */

async function renameItem(
item
) {


if (reorderMode) {
    return;
}


const input =
    prompt(
        "အမည်အသစ် ထည့်ပါ:",
        item.name
    );


if (input === null) {
    return;
}


const newName =
    input.trim();


if (
    !newName ||
    newName === item.name
) {
    return;
}


if (
    newName.includes("/") ||
    newName.includes("\\")
) {

    alert(
        "/ နှင့် \\ မသုံးရပါ။"
    );

    return;

}


const children =
    await getChildren(
        currentFolderId
    );


const duplicate =
    children.some(
        other =>
            other.id !== item.id &&
            other.name
                .toLowerCase() ===
            newName.toLowerCase()
    );


if (duplicate) {

    alert(
        "ဤအမည်ရှိ ဖိုင် သို့မဟုတ် ဖိုင်တွဲ ရှိပြီးသားဖြစ်သည်။"
    );

    return;

}


item.name =
    newName;


await updateItem(
    item
);


await displayCurrentFolder();


}

/* =====================================================
DELETE
===================================================== */

async function deleteItemAndChildren(
item,
ask = true
) {


if (reorderMode) {
    return;
}


if (ask) {

    const confirmed =
        confirm(
            `"${item.name}" ကို ဖျက်မလား?`
        );


    if (!confirmed) {
        return;
    }

}


const all =
    await getAllItems();


const ids =
    new Set([
        item.id
    ]);


let changed =
    true;


while (changed) {

    changed =
        false;


    for (
        const candidate of all
    ) {

        if (
            ids.has(
                candidate.parentId
            ) &&
            !ids.has(
                candidate.id
            )
        ) {

            ids.add(
                candidate.id
            );


            changed =
                true;

        }

    }

}


for (
    const id of ids
) {

    await deleteItem(
        id
    );

}


if (ask) {

    await displayCurrentFolder();

}


}

/* =====================================================
iOS-STYLE THREE-DOT COPY / CUT / PASTE MENU
===================================================== */

let actionMenuItemId =
null;

let clipboardItems =
[];

let clipboardMode =
null;

/* =====================================================
OPEN ACTION MENU
===================================================== */

async function openItemActionMenu(
itemId,
anchorEl
) {


actionMenuItemId =
    itemId;


const item =
    await getItem(
        itemId
    );


if (!item) {

    actionMenuItemId =
        null;

    return;

}


const title =
    document.getElementById(
        "touchMenuTitle"
    );


if (title) {

    title.textContent =
        item.name;

}


const copy =
    document.getElementById(
        "touchCopyAction"
    );


const cut =
    document.getElementById(
        "touchCutAction"
    );


const paste =
    document.getElementById(
        "touchPasteAction"
    );


if (copy) {

    copy.textContent =
        "ကူး";

}


if (cut) {

    cut.textContent =
        "ဖြတ်";

    cut.style.display =
        "block";

}


if (paste) {

    paste.style.display =
        "none";

}


const sheet =
    document.getElementById(
        "touchActionSheet"
    );


if (sheet) {

    sheet.classList.add(
        "show"
    );


    sheet.setAttribute(
        "aria-hidden",
        "false"
    );


    positionTouchMenu(
        anchorEl,
        sheet
    );

}


if (navigator.vibrate) {

    navigator.vibrate(8);

}


}

/* =====================================================
POSITION ACTION MENU
===================================================== */

function positionTouchMenu(
anchorEl,
sheet
) {


const card =
    sheet
        ? sheet.querySelector(
            ".touch-sheet-card"
        )
        : null;


if (
    !card ||
    !anchorEl
) {

    return;

}


requestAnimationFrame(
    () => {

        const r =
            anchorEl.getBoundingClientRect();


        const w =
            card.offsetWidth;


        const h =
            card.offsetHeight;


        const gap =
            8;


        const margin =
            10;


        const vw =
            window.innerWidth;


        const vh =
            window.innerHeight;


        let top =
            r.top -
            h -
            gap;


        if (
            top <
            margin
        ) {

            top =
                r.bottom +
                gap;

        }


        if (
            top + h >
            vh - margin
        ) {

            top =
                Math.max(
                    margin,
                    vh -
                    h -
                    margin
                );

        }


        let left =
            r.right -
            w;


        if (
            left <
            margin
        ) {

            left =
                margin;

        }


        if (
            left + w >
            vw - margin
        ) {

            left =
                vw -
                w -
                margin;

        }


        /* Keep the existing centered popup behavior. */

        card.style.left =
            "50%";


        card.style.top =
            "50%";


        card.style.right =
            "auto";


        card.style.bottom =
            "auto";


        card.style.margin =
            "0";


        card.style.transform =
            "translate(-50%, -50%)";

    }
);


}

/* =====================================================
CLOSE TOUCH MENU
===================================================== */

function closeTouchMenu() {


const sheet =
    document.getElementById(
        "touchActionSheet"
    );


if (sheet) {

    sheet.classList.remove(
        "show"
    );


    sheet.setAttribute(
        "aria-hidden",
        "true"
    );

}


actionMenuItemId =
    null;


}

/* =====================================================
CLIPBOARD
===================================================== */

function setClipboard(
itemId,
mode
) {


clipboardItems =
    [itemId];


clipboardMode =
    mode;


updatePasteFab();


if (navigator.vibrate) {

    navigator.vibrate(
        [10, 30, 10]
    );

}


}

/* =====================================================
COPY
===================================================== */

async function copyLongPressedItem() {



if (!actionMenuItemId) {
    return;
}


const item =
    await getItem(
        actionMenuItemId
    );


setClipboard(
    actionMenuItemId,
    "copy"
);


closeTouchMenu();


message.textContent =
    (
        item
            ? item.name
            : "ဖိုင်"
    ) +
    " ကို ကူးယူထားပါပြီ။ Destination folder သို့သွားပြီး ကပ်ပါ။";


}

/* =====================================================
CUT
===================================================== */

async function cutItemFromMenu() {


if (!actionMenuItemId) {
    return;
}


const item =
    await getItem(
        actionMenuItemId
    );


setClipboard(
    actionMenuItemId,
    "cut"
);


closeTouchMenu();


message.textContent =
    (
        item
            ? item.name
            : "ဖိုင်"
    ) +
    " ကို ဖြတ်ယူထားပါပြီ။ Destination folder သို့သွားပြီး ကပ်ပါ။";


}

/* =====================================================
UNIQUE NAME
===================================================== */

function getUniqueName(
name,
existingNames
) {


if (
    !existingNames.has(
        name.toLowerCase()
    )
) {

    return name;

}


const dot =
    name.lastIndexOf(".");


const base =
    dot > 0
        ? name.slice(
            0,
            dot
        )
        : name;


const ext =
    dot > 0
        ? name.slice(dot)
        : "";


let n =
    1;


let candidate;


do {

    candidate =
        `${base} (${n})${ext}`;


    n++;

} while (
    existingNames.has(
        candidate.toLowerCase()
    )
);


return candidate;


}

/* =====================================================
CLONE TREE
===================================================== */

async function cloneItemTree(
sourceId,
destinationParentId
) {


const all =
    await getAllItems();


const source =
    all.find(
        x =>
            x.id ===
            sourceId
    );


if (!source) {

    throw new Error(
        "ကူးထားသော ဖိုင်/ဖိုင်တွဲ မရှိပါ။"
    );

}


const children =
    all.filter(
        x =>
            x.parentId ===
            sourceId
    );


const destinationChildren =
    all.filter(
        x =>
            x.parentId ===
            destinationParentId
    );


const names =
    new Set(
        destinationChildren.map(
            x =>
                x.name.toLowerCase()
        )
    );


const rootCopy = {

    ...source,

    id:
        makeId(),

    parentId:
        destinationParentId,

    name:
        getUniqueName(
            source.name,
            names
        ),

    position:
        await getNextPosition(
            destinationParentId
        ),

    createdAt:
        Date.now()

};


names.add(
    rootCopy.name.toLowerCase()
);


await addItem(
    rootCopy
);


if (
    source.type ===
    "folder"
) {

    for (
        const child of children
    ) {

        await cloneItemTree(
            child.id,
            rootCopy.id
        );

    }

}


return rootCopy;


}

/* =====================================================
DESCENDANT CHECK
===================================================== */

async function isDescendantFolder(
sourceId,
possibleParentId
) {


if (
    sourceId ===
    possibleParentId
) {

    return true;

}


let cur =
    await getItem(
        possibleParentId
    );


while (
    cur &&
    cur.parentId
) {

    if (
        cur.parentId ===
        sourceId
    ) {

        return true;

    }


    cur =
        await getItem(
            cur.parentId
        );

}


return false;


}

/* =====================================================
PASTE
===================================================== */

async function pasteClipboardItems() {


if (
    !clipboardItems.length ||
    reorderMode
) {

    return;

}


try {

    const source =
        await getItem(
            clipboardItems[0]
        );


    if (!source) {

        alert(
            "ကူး/ဖြတ်ထားသော ဖိုင် မရှိပါ။"
        );

        return;

    }


    if (
        source.type ===
        "folder" &&
        await isDescendantFolder(
            source.id,
            currentFolderId
        )
    ) {

        alert(
            "ဖိုင်တွဲကို ၎င်း၏အတွင်းပိုင်းထဲသို့ ကပ်၍ မရပါ။"
        );

        return;

    }


    showUploadStatus(
        clipboardMode === "cut"
            ? "ဖိုင်ကို ရွှေ့နေပါသည်..."
            : "ဖိုင်ကို ကူးနေပါသည်..."
    );


    if (
        clipboardMode ===
        "cut"
    ) {

        const children =
            await getChildren(
                currentFolderId
            );


        const existing =
            children.find(
                x =>
                    x.name.toLowerCase() ===
                    source.name.toLowerCase() &&
                    x.id !== source.id
            );


        if (existing) {

            source.name =
                getUniqueName(
                    source.name,
                    new Set(
                        children
                            .filter(
                                x =>
                                    x.id !==
                                    existing.id
                            )
                            .map(
                                x =>
                                    x.name.toLowerCase()
                            )
                    )
                );

        }


        source.parentId =
            currentFolderId;


        source.position =
            await getNextPosition(
                currentFolderId
            );


        await updateItem(
            source
        );


        clipboardItems =
            [];


        clipboardMode =
            null;

    } else {

        await cloneItemTree(
            source.id,
            currentFolderId
        );


        clipboardItems =
            [];


        clipboardMode =
            null;

    }


    hideUploadStatus();


    closeTouchMenu();


    clipboardItems =
        [];


    clipboardMode =
        null;


    actionMenuItemId =
        null;


    updatePasteFab();


    await displayCurrentFolder();


    message.textContent =
        "ကပ်ပြီးပါပြီ။";


} catch (error) {

    hideUploadStatus();

    console.error(error);

    alert(
        "ကပ်၍ မရပါ။\n\n" +
        error.message
    );

}


}


/* =====================================================
PASTE FAB
===================================================== */

function updatePasteFab() {
    const fab =
        document.getElementById(
            "v4PasteFab"
        );

    const cancel =
        document.getElementById(
            "v4PasteCancel"
        );

    if (!fab) {
        return;
    }

    const hasClipboard =
        Array.isArray(
            clipboardItems
        ) &&
        clipboardItems.length >
        0;

    fab.classList.toggle(
        "show",
        hasClipboard
    );

    fab.style.display =
        hasClipboard
            ? "block"
            : "none";

    if (cancel) {
        cancel.classList.toggle(
            "show",
            hasClipboard
        );
    }

    if (hasClipboard) {
        const label =
            fab.querySelector(
                ".paste-label"
            );

        if (label) {
            label.textContent =
                clipboardMode ===
                "cut"
                    ? "ကပ် • ဖြတ်ထားသည်"
                    : "ကပ် • ကူးထားသည်";
        }
    }
}



/* =====================================================
LONG PRESS
===================================================== */

function attachLongPress(
row,
item
) {


/*
 * Long-press is intentionally disabled.
 * Use the ••• button for iOS-style actions.
 */


}

/* =====================================================
LEGACY STUB
===================================================== */

async function copySelectedItems() {
return;
}

/* =====================================================
REFRESH
===================================================== */

refreshBtn.addEventListener(
"click",
async () => {


    if (reorderMode) {
        return;
    }


    await displayCurrentFolder();

}


);

/* =====================================================
REORDER
===================================================== */

reorderBtn.addEventListener(
"click",
async () => {


    if (reorderMode) {
        return;
    }


    await enterReorderMode();

}


);

/* =====================================================
ENTER REORDER
===================================================== */

async function enterReorderMode() {


const children =
    await getChildren(
        currentFolderId
    );


const sorted =
    sortItems(
        children
    );


originalOrder =
    sorted.map(
        item =>
            item.id
    );


workingOrder =
    [...originalOrder];


reorderMode =
    true;


reorderBar.classList.remove(
    "hidden"
);


reorderBtn.disabled =
    true;


newFolderBtn.disabled =
    true;


uploadBtn.disabled =
    true;


uploadFolderBtn.disabled =
    true;


refreshBtn.disabled =
    true;


homeBtn.disabled =
    true;


upBtn.disabled =
    true;


searchBox.disabled =
    true;


renderReorderList();


message.textContent =
    "အပေါ် / အောက်မြှားဖြင့် အစီအစဉ်ပြောင်းပါ။";


}

/* =====================================================
RENDER REORDER
===================================================== */

async function renderReorderList() {


fileList.innerHTML =
    "";


const all =
    await getAllItems();


const map =
    new Map();


all.forEach(
    item => {

        map.set(
            item.id,
            item
        );

    }
);


workingOrder.forEach(
    (id, index) => {

        const item =
            map.get(
                id
            );


        if (!item) {
            return;
        }


        createReorderItem(
            item,
            index
        );

    }
);


}

/* =====================================================
CREATE REORDER ITEM
===================================================== */

function createReorderItem(
item,
index
) {


const row =
    document.createElement(
        "div"
    );


row.className =
    "file-item reorder-row";


const number =
    document.createElement(
        "div"
    );


number.className =
    "position";


number.textContent =
    toMyanmarNumber(
        index + 1
    );


row.appendChild(
    number
);


const icon =
    document.createElement(
        "div"
    );


icon.className =
    "file-icon";


icon.textContent =
    item.type === "folder"
        ? "📁"
        : getIcon(
            item.name
        );


row.appendChild(
    icon
);


const info =
    document.createElement(
        "div"
    );


info.className =
    "file-info";


const name =
    document.createElement(
        "div"
    );


name.className =
    "file-name";


name.textContent =
    item.name;


info.appendChild(
    name
);


const type =
    document.createElement(
        "div"
    );


type.className =
    "file-type";


type.textContent =
    item.type === "folder"
        ? "ဖိုင်တွဲ"
        : getFileType(
            item.name
        );


info.appendChild(
    type
);


row.appendChild(
    info
);


const buttons =
    document.createElement(
        "div"
    );


buttons.className =
    "reorder-buttons";


const up =
    document.createElement(
        "button"
    );


up.type =
    "button";


up.className =
    "move-btn";


up.textContent =
    "▲";


up.disabled =
    index === 0;


up.addEventListener(
    "click",
    () => {

        moveItem(
            index,
            index - 1
        );

    }
);


buttons.appendChild(
    up
);


const down =
    document.createElement(
        "button"
    );


down.type =
    "button";


down.className =
    "move-btn";


down.textContent =
    "▼";


down.disabled =
    index ===
    workingOrder.length - 1;


down.addEventListener(
    "click",
    () => {

        moveItem(
            index,
            index + 1
        );

    }
);


buttons.appendChild(
    down
);


row.appendChild(
    buttons
);


fileList.appendChild(
    row
);


}

/* =====================================================
MOVE ITEM
===================================================== */

function moveItem(
from,
to
) {


if (
    to < 0 ||
    to >= workingOrder.length
) {

    return;

}


const item =
    workingOrder.splice(
        from,
        1
    )[0];


workingOrder.splice(
    to,
    0,
    item
);


renderReorderList();


}

/* =====================================================
SAVE ORDER
===================================================== */

saveOrderBtn.addEventListener(
"click",
async () => {


    try {

        for (
            let index = 0;
            index <
            workingOrder.length;
            index++
        ) {

            const item =
                await getItem(
                    workingOrder[index]
                );


            if (item) {

                item.position =
                    index;


                await updateItem(
                    item
                );

            }

        }


        reorderMode =
            false;


        originalOrder =
            [];


        workingOrder =
            [];


        reorderBar.classList.add(
            "hidden"
        );


        enableNormalControls();


        await displayCurrentFolder();


        message.textContent =
            "အစီအစဉ် သိမ်းပြီးပါပြီ။";


    } catch (error) {

        console.error(error);

        alert(
            "အစီအစဉ် သိမ်း၍မရပါ။\n\n" +
            error.message
        );

    }

}


);

/* =====================================================
CANCEL ORDER
===================================================== */

cancelOrderBtn.addEventListener(
"click",
async () => {


    reorderMode =
        false;


    workingOrder =
        [];


    originalOrder =
        [];


    reorderBar.classList.add(
        "hidden"
    );


    enableNormalControls();


    await displayCurrentFolder();


    message.textContent =
        "အစီအစဉ်ပြောင်းလဲမှုကို ပယ်ဖျက်လိုက်ပါပြီ။";

}


);

/* =====================================================
NORMAL CONTROLS
===================================================== */

function enableNormalControls() {


reorderBtn.disabled =
    false;


newFolderBtn.disabled =
    false;


uploadBtn.disabled =
    false;


uploadFolderBtn.disabled =
    false;


refreshBtn.disabled =
    false;


homeBtn.disabled =
    false;


searchBox.disabled =
    false;


updateNavigation();


}

/* =====================================================
SEARCH
===================================================== */

searchBox.addEventListener(
"input",
() => {


    clearTimeout(
        searchTimer
    );


    searchTimer =
        setTimeout(
            async () => {

                const text =
                    searchBox.value
                        .trim()
                        .toLowerCase();


                if (!text) {

                    await displayCurrentFolder();

                    return;

                }


                await searchAll(
                    text
                );

            },
            200
        );

}


);

/* =====================================================
SEARCH ALL
===================================================== */

async function searchAll(
search
) {


const all =
    await getAllItems();


const results =
    all.filter(
        item => {

            if (
                item.id === "root"
            ) {

                return false;

            }


            const name =
                (
                    item.name ||
                    ""
                ).toLowerCase();


            const searchText =
                (
                    item.searchText ||
                    ""
                ).toLowerCase();


            return (
                name.includes(search) ||
                searchText.includes(search)
            );

        }
    );


fileList.innerHTML =
    "";


if (!results.length) {

    fileList.innerHTML = `

        <div class="empty">

            <div class="empty-icon">
                🔍
            </div>

            <h2>
                မတွေ့ပါ
            </h2>

            <p>
                ကိုက်ညီသော ဖိုင် သို့မဟုတ်
                ဖိုင်တွဲ မရှိပါ။
            </p>

        </div>

    `;


    message.textContent =
        "ရှာဖွေမှုရလဒ် မတွေ့ပါ။";


    return;

}


const sorted =
    [...results].sort(
        (a, b) =>
            a.name.localeCompare(
                b.name,
                "my"
            )
    );


for (
    let i = 0;
    i < sorted.length;
    i++
) {

    await createSearchItem(
        sorted[i],
        i + 1
    );

}


message.textContent =
    toMyanmarNumber(
        sorted.length
    ) +
    " ခု တွေ့ရှိပါသည်။";


}

/* =====================================================
SEARCH ITEM
===================================================== */

async function createSearchItem(
item,
position
) {


const row =
    document.createElement(
        "div"
    );


row.className =
    "file-item search-result";


const number =
    document.createElement(
        "div"
    );


number.className =
    "position";


number.textContent =
    toMyanmarNumber(
        position
    );


row.appendChild(
    number
);


const icon =
    document.createElement(
        "div"
    );


icon.className =
    "file-icon";


icon.textContent =
    item.type === "folder"
        ? "📁"
        : getIcon(
            item.name
        );


row.appendChild(
    icon
);


const info =
    document.createElement(
        "div"
    );


info.className =
    "file-info";


const name =
    document.createElement(
        "div"
    );


name.className =
    "file-name";


name.textContent =
    item.name;


info.appendChild(
    name
);


const pathText =
    document.createElement(
        "div"
    );


pathText.className =
    "search-path";


pathText.textContent =
    await getItemPath(
        item
    );


info.appendChild(
    pathText
);


row.appendChild(
    info
);


const empty =
    document.createElement(
        "div"
    );


row.appendChild(
    empty
);


row.addEventListener(
    "click",
    async () => {

        if (
            item.type ===
            "folder"
        ) {

            await openSearchFolder(
                item
            );

        } else {

            await openFile(
                item
            );

        }

    }
);


fileList.appendChild(
    row
);


}

/* =====================================================
OPEN SEARCH FOLDER
===================================================== */

async function openSearchFolder(
folder
) {


const all =
    await getAllItems();


const map =
    new Map();


all.forEach(
    item => {

        map.set(
            item.id,
            item
        );

    }
);


const path =
    [];


let current =
    folder;


while (current) {

    path.unshift({

        id:
            current.id,

        name:
            current.name

    });


    if (
        current.id ===
        "root"
    ) {

        break;

    }


    current =
        map.get(
            current.parentId
        );

}


folderStack =
    path;


currentFolderId =
    folder.id;


searchBox.value =
    "";


await displayCurrentFolder();


}

/* =====================================================
EMPTY
===================================================== */

function showEmpty() {


fileList.innerHTML = `

    <div class="empty">

        <div class="empty-icon">
            📭
        </div>

        <h2>
            ဖိုင်တွဲအလွတ်
        </h2>

        <p>
            ဖိုင်တင်ပါ သို့မဟုတ်
            ဖိုင်တွဲအသစ်ဖန်တီးပါ။
        </p>

    </div>

`;


}

/* =====================================================
FILE TYPE
===================================================== */

function getFileType(
name
) {


const dot =
    name.lastIndexOf(".");


if (dot === -1) {
    return "ဖိုင်";
}


return (
    name
        .slice(dot + 1)
        .toUpperCase() +
    " ဖိုင်"
);


}

/* =====================================================
FILE SIZE
===================================================== */

function formatFileSize(
bytes
) {


if (
    !bytes ||
    bytes <= 0
) {

    return "0 B";

}


const units = [
    "B",
    "KB",
    "MB",
    "GB"
];


let size =
    bytes;


let unitIndex =
    0;


while (
    size >= 1024 &&
    unitIndex <
    units.length - 1
) {

    size =
        size / 1024;


    unitIndex++;

}


return (
    size.toFixed(
        unitIndex === 0
            ? 0
            : 2
    ) +
    " " +
    units[
        unitIndex
    ]
);


}

/* =====================================================
ICON
===================================================== */

function getIcon(
name
) {


const parts =
    name.split(".");


const ext =
    parts.length > 1
        ? parts
            .pop()
            .toLowerCase()
        : "";


const icons = {

    pdf: "📕",

    doc: "📘",
    docx: "📘",

    xls: "📗",
    xlsx: "📗",

    ppt: "📙",
    pptx: "📙",

    txt: "📝",

    csv: "📊",

    html: "🌐",
    htm: "🌐",

    css: "🎨",

    js: "🧩",

    json: "📋",

    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    webp: "🖼️",
    svg: "🖼️",

    mp3: "🎵",
    wav: "🎵",
    flac: "🎵",

    mp4: "🎬",
    webm: "🎬",
    mov: "🎬",
    avi: "🎬",

    zip: "📦",
    rar: "📦",
    "7z": "📦"

};


return (
    icons[ext] ||
    "📄"
);


}

/* =====================================================
MYANMAR NUMBERS
===================================================== */

function toMyanmarNumber(
value
) {


const digits = [
    "၀",
    "၁",
    "၂",
    "၃",
    "၄",
    "၅",
    "၆",
    "၇",
    "၈",
    "၉"
];


return String(
    value
).replace(
    /\d/g,
    digit =>
        digits[
            Number(digit)
        ]
);


}

/* =====================================================
IOS MENU BUTTON
===================================================== */

function initializeHeaderMenu() {


const menuButton =
    document.getElementById(
        "headerMenuBtn"
    );


const toolbar =
    document.getElementById(
        "mainToolbar"
    );


if (
    !menuButton ||
    !toolbar
) {

    return;

}


menuButton.addEventListener(
    "click",
    () => {

        const collapsed =
            toolbar.classList.toggle(
                "menu-collapsed"
            );


        menuButton.classList.toggle(
            "is-open",
            !collapsed
        );


        menuButton.setAttribute(
            "aria-expanded",
            String(
                !collapsed
            )
        );

    }
);


}

/* =====================================================
START
===================================================== */

window.addEventListener(
"DOMContentLoaded",
() => {


    initialize();

    initializeHeaderMenu();

}


);

/* =====================================================
TOUCH FEEDBACK
External JS version.
===================================================== */

(function initTouchScreenMode() {


const selector =
    "button,.file-item";


function addPress(el) {

    if (
        el &&
        !el.disabled
    ) {

        el.classList.add(
            "touch-active"
        );

    }

}


function removePress(el) {

    if (el) {

        el.classList.remove(
            "touch-active"
        );

    }

}


document.addEventListener(
    "pointerdown",
    function (e) {

        const el =
            e.target.closest(
                selector
            );


        if (
            !el ||
            el.disabled
        ) {

            return;

        }


        addPress(
            el
        );

    },
    {
        passive: true
    }
);


[
    "pointerup",
    "pointercancel",
    "pointerleave",
    "blur"
].forEach(
    type => {

        document.addEventListener(
            type,
            function (e) {

                const el =
                    e.target &&
                    e.target.closest
                        ? e.target.closest(
                            selector
                        )
                        : null;


                removePress(
                    el
                );

            },
            {
                passive: true
            }
        );

    }
);


document.addEventListener(
    "click",
    function (e) {

        const el =
            e.target.closest(
                "button"
            );


        if (
            !el ||
            el.disabled
        ) {

            return;

        }


        if (
            navigator.vibrate
        ) {

            navigator.vibrate(
                8
            );

        }

    },
    {
        passive: true
    }
);


const toolbar =
    document.getElementById(
        "mainToolbar"
    );


if (toolbar) {

    toolbar.addEventListener(
        "wheel",
        function (e) {

            if (
                window.innerWidth <=
                700 &&
                Math.abs(
                    e.deltaY
                ) >
                Math.abs(
                    e.deltaX
                )
            ) {

                toolbar.scrollLeft +=
                    e.deltaY;

            }

        },
        {
            passive: true
        }
    );

}


})();


/* =====================================================
TOUCH ACTION SHEET
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const sheet =
            document.getElementById(
                "touchActionSheet"
            );

        const copyAction =
            document.getElementById(
                "touchCopyAction"
            );

        const cutAction =
            document.getElementById(
                "touchCutAction"
            );

        const pasteAction =
            document.getElementById(
                "touchPasteAction"
            );

        const cancelAction =
            document.getElementById(
                "touchCancelAction"
            );

        const pasteFab =
            document.getElementById(
                "v4PasteFab"
            );

        const pasteCancel =
            document.getElementById(
                "v4PasteCancel"
            );


        /* =================================================
           COPY
           ================================================= */

        if (copyAction) {

            copyAction.addEventListener(
                "click",
                copyLongPressedItem
            );

        }


        /* =================================================
           CUT
           ================================================= */

        if (cutAction) {

            cutAction.addEventListener(
                "click",
                cutItemFromMenu
            );

        }


        /* =================================================
           PASTE FROM ACTION SHEET
           ================================================= */

        if (pasteAction) {

            pasteAction.addEventListener(
                "click",
                pasteClipboardItems
            );

        }


        /* =================================================
           CANCEL ACTION SHEET
           ================================================= */

        if (cancelAction) {

            cancelAction.addEventListener(
                "click",
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    closeTouchMenu();

                }
            );

        }


        /* =================================================
           PASTE FAB
           ================================================= */


if (pasteFab) {
    pasteFab.addEventListener(
        "click",
        event => {
            event.preventDefault();
            event.stopPropagation();

            const clickedCancel =
                event.target &&
                event.target.closest &&
                event.target.closest(
                    "#v4PasteCancel"
                );

            if (clickedCancel) {
                return;
            }

            pasteClipboardItems();
        }
    );
}



        /* =================================================
           CANCEL X
           ================================================= */

        if (pasteCancel) {
    pasteCancel.addEventListener(
        "click",
        event => {
            event.preventDefault();
            event.stopImmediatePropagation();

            clipboardItems = [];
            clipboardMode = null;
            actionMenuItemId = null;

            updatePasteFab();

            message.textContent =
                "ကူး/ဖြတ်ထားသော ဖိုင်ကို ပယ်ဖျက်လိုက်ပါပြီ။";
        },
        true
    );
}


        /* =================================================
           CLOSE ACTION SHEET BACKDROP
           ================================================= */

        if (sheet) {

            sheet.addEventListener(
                "click",
                event => {

                    if (
                        event.target.dataset.touchClose
                    ) {

                        closeTouchMenu();

                    }

                }
            );

        }


        /* =================================================
           INITIAL PASTE FAB STATE
           ================================================= */

        updatePasteFab();

    }
);



/* =====================================================
PWA DIAGNOSTIC V11
Normal UI is unchanged.
Add ?diagnose=1 to the URL to open diagnostic panel.
===================================================== */

(function () {


"use strict";


const DIAG_MODE =
    new URLSearchParams(
        location.search
    ).get("diagnose") === "1";


function esc(value) {

    return String(
        value ?? ""
    ).replace(
        /[&<>"']/g,
        c =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[c]
    );

}


function stateLabel(
    reg
) {

    if (!reg) {
        return "not registered";
    }


    const worker =
        reg.active ||
        reg.waiting ||
        reg.installing;


    return worker
        ? worker.state
        : "registered, no worker state yet";

}


async function inspectPWA() {

    const rows =
        [];


    rows.push([
        "URL",
        location.href
    ]);


    rows.push([
        "Origin",
        location.origin
    ]);


    rows.push([
        "Protocol",
        location.protocol
    ]);


    rows.push([
        "Secure context",
        String(
            window.isSecureContext
        )
    ]);


    rows.push([
        "Service Worker API",
        String(
            "serviceWorker" in
            navigator
        )
    ]);


    rows.push([
        "Controller",
        navigator.serviceWorker?.controller
            ? "YES"
            : "NO (reload may be required)"
    ]);


    let reg =
        null;


    if (
        "serviceWorker" in
        navigator
    ) {

        try {

            reg =
                await navigator.serviceWorker
                    .getRegistration(
                        "./"
                    );


            if (!reg) {

                reg =
                    await navigator.serviceWorker
                        .getRegistration();

            }


            rows.push([
                "Registration",
                reg
                    ? "FOUND"
                    : "NOT FOUND"
            ]);


            if (reg) {

                rows.push([
                    "Scope",
                    reg.scope
                ]);


                rows.push([
                    "Worker state",
                    stateLabel(reg)
                ]);


                rows.push([
                    "UpdateViaCache",
                    reg.updateViaCache ||
                    "browser default"
                ]);


                try {

                    await reg.update();


                    rows.push([
                        "Update check",
                        "OK / requested"
                    ]);

                } catch (e) {

                    rows.push([
                        "Update check",
                        "FAILED: " +
                        (
                            e.message ||
                            e
                        )
                    ]);

                }

            }

        } catch (e) {

            rows.push([
                "Registration check",
                "ERROR: " +
                (
                    e.message ||
                    e
                )
            ]);

        }

    }


    try {

        const r =
            await fetch(
                "./manifest.json",
                {
                    cache:
                        "no-store"
                }
            );


        rows.push([
            "manifest.json",
            r.ok
                ? "HTTP " +
                  r.status
                : "HTTP " +
                  r.status +
                  " FAILED"
        ]);

    } catch (e) {

        rows.push([
            "manifest.json",
            "FETCH FAILED: " +
            (
                e.message ||
                e
            )
        ]);

    }


    try {

        const r =
            await fetch(
                "./sw.js",
                {
                    cache:
                        "no-store"
                }
            );


        rows.push([
            "sw.js",
            r.ok
                ? "HTTP " +
                  r.status
                : "HTTP " +
                  r.status +
                  " FAILED"
        ]);

    } catch (e) {

        rows.push([
            "sw.js",
            "FETCH FAILED: " +
            (
                e.message ||
                e
            )
        ]);

    }


    if (
        "caches" in
        window
    ) {

        try {

            const names =
                await caches.keys();


            rows.push([
                "Cache Storage",
                names.length
                    ? names.join(", ")
                    : "EMPTY"
            ]);

        } catch (e) {

            rows.push([
                "Cache Storage",
                "ERROR: " +
                (
                    e.message ||
                    e
                )
            ]);

        }

    } else {

        rows.push([
            "Cache Storage API",
            "NOT AVAILABLE"
        ]);

    }


    const panel =
        document.getElementById(
            "v11DiagBody"
        );


    if (panel) {

        panel.innerHTML =
            rows.map(
                ([k, v]) =>
                    '<div class="v11-row">' +
                    '<b>' +
                    esc(k) +
                    '</b>' +
                    '<span>' +
                    esc(v) +
                    '</span>' +
                    '</div>'
            ).join("");

    }


    const now =
        document.getElementById(
            "v11DiagTime"
        );


    if (now) {

        now.textContent =
            new Date()
                .toLocaleString();

    }

}


function showDiagnosticPanel() {

    if (
        !DIAG_MODE ||
        document.getElementById(
            "v11PwaDiag"
        )
    ) {

        return;

    }


    const panel =
        document.createElement(
            "section"
        );


    panel.id =
        "v11PwaDiag";


    panel.innerHTML =
        '<div class="v11-diag-head">' +
        '<strong>PWA Diagnostic V11</strong>' +
        '<button id="v11DiagClose" type="button">×</button>' +
        '</div>' +

        '<div id="v11DiagBody" class="v11-diag-body">' +
        'Checking…' +
        '</div>' +

        '<div class="v11-diag-foot">' +
        '<span id="v11DiagTime"></span>' +
        '<button id="v11DiagRefresh" type="button">Refresh</button>' +
        '</div>';


    document.body.appendChild(
        panel
    );


    const closeButton =
        document.getElementById(
            "v11DiagClose"
        );


    if (closeButton) {

        closeButton.onclick =
            () => panel.remove();

    }


    const refreshButton =
        document.getElementById(
            "v11DiagRefresh"
        );


    if (refreshButton) {

        refreshButton.onclick =
            inspectPWA;

    }


    inspectPWA();

}


async function registerAppWorker() {

    if (
        !("serviceWorker" in
            navigator)
    ) {

        console.warn(
            "[Mobile V4 PWA] Service Worker API is unavailable."
        );


        if (DIAG_MODE) {

            showDiagnosticPanel();

        }


        return;

    }


    if (
        !window.isSecureContext
    ) {

        console.warn(
            "[Mobile V4 PWA] Not a secure context. HTTPS must be trusted, or use localhost."
        );


        if (DIAG_MODE) {

            showDiagnosticPanel();

        }


        return;

    }


    try {

        const reg =
            await navigator.serviceWorker.register(
                "./sw.js",
                {
                    scope:
                        "./",

                    updateViaCache:
                        "none"
                }
            );


        /*
         * Reload the page when the new
         * Service Worker takes control.
         */

        navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => {

                window.location.reload();

            }
        );


        if (reg.waiting) {

            showUpdateAvailable(
                reg
            );

        }


        reg.addEventListener(
            "updatefound",
            () => {

                const newWorker =
                    reg.installing;


                if (!newWorker) {
                    return;
                }


                newWorker.addEventListener(
                    "statechange",
                    () => {

                        if (
                            newWorker.state ===
                            "installed" &&
                            navigator.serviceWorker
                                .controller
                        ) {

                            showUpdateAvailable(
                                reg
                            );

                        }

                    }
                );

            }
        );


        console.log(
            "[Mobile V4 PWA] Service worker registration:",
            reg.scope
        );


        try {

            await reg.update();

        } catch (e) {

            console.warn(
                "[Mobile V4 PWA] update() failed:",
                e
            );

        }


        if (DIAG_MODE) {

            inspectPWA();

        }

    } catch (err) {

        console.error(
            "[Mobile V4 PWA] registration FAILED:",
            err
        );


        if (DIAG_MODE) {

            inspectPWA();

        }

    }

}


/*
 * IMPORTANT:
 * The diagnostic IIFE ends here.
 *
 * Functions below this point are intentionally
 * outside the IIFE so createFileItem() and the
 * other application code can access them.
 */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            registerAppWorker();

            showDiagnosticPanel();

        },
        {
            once: true
        }
    );

} else {

    registerAppWorker();

    showDiagnosticPanel();

}


})();

/* =====================================================
FAVORITES
===================================================== */

async function displayFavorites() {


if (reorderMode) {
    return;
}


fileList.innerHTML =
    "";


const allItems =
    await getAllItems();


const favorites =
    allItems.filter(
        item =>
            item.favorite ===
            true
    );


renderFavoritesBreadcrumb();


if (!favorites.length) {

    showEmpty();


    message.textContent =
        "အကြိုက်ဆုံး ဖိုင် မရှိသေးပါ။";


    updateNavigation();


    return;

}


favorites.forEach(
    (item, index) => {

        createFileItem(
            item,
            index + 1
        );

    }
);


message.textContent =
    toMyanmarNumber(
        favorites.length
    ) +
    " ခု";


updateNavigation();


}

/* =====================================================
FAVORITES BREADCRUMB
===================================================== */

function renderFavoritesBreadcrumb() {


breadcrumb.innerHTML =
    "";


const item =
    document.createElement(
        "span"
    );


item.className =
    "breadcrumb-current";


item.textContent =
    "⭐ အကြိုက်ဆုံး";


breadcrumb.appendChild(
    item
);


}

/* =====================================================
ITEM PATH
===================================================== */

async function getItemPath(
item
) {


const allItems =
    await getAllItems();


const path =
    [];


let current =
    item;


while (current) {

    if (
        current.type ===
        "folder"
    ) {

        path.unshift(
            current.name
        );

    }


    if (
        !current.parentId
    ) {

        break;

    }


    current =
        allItems.find(
            x =>
                x.id ===
                current.parentId
        );

}


return path.join(
    " › "
);


}

/* =====================================================
RECENT DOCUMENTS
===================================================== */

async function displayRecentDocuments() {


if (reorderMode) {
    return;
}


fileList.innerHTML =
    "";


const allItems =
    await getAllItems();


const recentDocuments =
    allItems
        .filter(
            item =>
                item.type !==
                "folder" &&
                item.lastOpened
        )
        .sort(
            (a, b) =>
                b.lastOpened -
                a.lastOpened
        );


breadcrumb.innerHTML =
    "";


const item =
    document.createElement(
        "span"
    );


item.className =
    "breadcrumb-current";


item.textContent =
    "🕘 Recent";


breadcrumb.appendChild(
    item
);


if (
    !recentDocuments.length
) {

    showEmpty();


    message.textContent =
        "No recent documents.";


    updateNavigation();


    return;

}


for (
    let index = 0;
    index <
    recentDocuments.length;
    index++
) {

    const recentItem =
        recentDocuments[
            index
        ];


    const folderPath =
        await getItemPath(
            recentItem
        );


    createFileItem(
        recentItem,
        index + 1
    );


    const row =
        fileList.lastElementChild;


    if (
        row &&
        folderPath
    ) {

        const pathInfo =
            document.createElement(
                "div"
            );


        pathInfo.className =
            "recent-file-path";


        pathInfo.textContent =
            "📁 " +
            folderPath;


        const fileInfo =
            row.querySelector(
                ".file-info"
            );


        if (fileInfo) {

            fileInfo.appendChild(
                pathInfo
            );

        }

    }

}


message.textContent =
    toMyanmarNumber(
        recentDocuments.length
    ) +
    " ခု";


updateNavigation();


}

/* =====================================================
FILE DETAILS
===================================================== */

async function showFileDetails(
item
) {


if (!item) {
    return;
}


const existing =
    document.getElementById(
        "fileDetailsModal"
    );


if (existing) {

    existing.remove();

}


const modal =
    document.createElement(
        "div"
    );


modal.id =
    "fileDetailsModal";


modal.className =
    "file-details-modal";


const card =
    document.createElement(
        "div"
    );


card.className =
    "file-details-card";


const title =
    document.createElement(
        "h3"
    );


title.textContent =
    "ⓘ File Details";


card.appendChild(
    title
);


/* Name */

const name =
    document.createElement(
        "div"
    );


name.className =
    "file-detail-row";


name.innerHTML =
    "<strong>Name</strong><span></span>";


name.querySelector(
    "span"
).textContent =
    item.name;


card.appendChild(
    name
);


/* Type */

const type =
    document.createElement(
        "div"
    );


type.className =
    "file-detail-row";


type.innerHTML =
    "<strong>Type</strong><span></span>";


type.querySelector(
    "span"
).textContent =
    item.type === "folder"
        ? "Folder"
        : getFileType(
            item.name
        );


card.appendChild(
    type
);


/* Size */

const size =
    document.createElement(
        "div"
    );


size.className =
    "file-detail-row";


size.innerHTML =
    "<strong>Size</strong><span></span>";


if (
    item.type !== "folder" &&
    item.blob
) {

    size.querySelector(
        "span"
    ).textContent =
        formatFileSize(
            item.blob.size
        );

} else {

    size.querySelector(
        "span"
    ).textContent =
        "-";

}


card.appendChild(
    size
);


/* Location */

const location =
    document.createElement(
        "div"
    );


location.className =
    "file-detail-row";


location.innerHTML =
    "<strong>Location</strong><span></span>";


location.querySelector(
    "span"
).textContent =
    "Loading...";


card.appendChild(
    location
);


/* Close */

const closeBtn =
    document.createElement(
        "button"
    );


closeBtn.type =
    "button";


closeBtn.className =
    "file-details-close";


closeBtn.textContent =
    "Close";


closeBtn.addEventListener(
    "click",
    () =>
        modal.remove()
);


card.appendChild(
    closeBtn
);


modal.appendChild(
    card
);


document.body.appendChild(
    modal
);


/* Load location */

try {

    location.querySelector(
        "span"
    ).textContent =
        await getItemPath(
            item
        );

} catch (error) {

    console.error(
        "Could not get file location:",
        error
    );


    location.querySelector(
        "span"
    ).textContent =
        "-";

}


}

/* =====================================================
PERSISTENT STORAGE
===================================================== */

async function requestPersistentStorage() {


if (
    !navigator.storage ||
    !navigator.storage.persist
) {

    return;

}


try {

    const alreadyPersistent =
        await navigator.storage.persisted();


    if (alreadyPersistent) {

        console.log(
            "Persistent storage: already enabled"
        );


        return;

    }


    const granted =
        await navigator.storage.persist();


    console.log(
        "Persistent storage:",
        granted
            ? "enabled"
            : "not granted"
    );

} catch (error) {

    console.log(
        "Persistent storage request failed:",
        error
    );

}


}

/* =====================================================
PWA UPDATE NOTICE
===================================================== */

function showUpdateAvailable(
reg
) {


if (
    document.getElementById(
        "pwaUpdateNotice"
    )
) {

    return;

}


const notice =
    document.createElement(
        "div"
    );


notice.id =
    "pwaUpdateNotice";


notice.innerHTML = `
    <div style="
        position:fixed;
        left:50%;
        bottom:20px;
        transform:translateX(-50%);
        z-index:99999;
        width:min(92vw,420px);
        padding:16px;
        border-radius:18px;
        background:#ffffff;
        box-shadow:0 10px 35px rgba(0,0,0,.22);
        border:1px solid #e5e7eb;
        font-family:inherit;
    ">
        <div style="
            font-size:16px;
            font-weight:700;
            margin-bottom:6px;
        ">
            New version available
        </div>

        <div style="
            font-size:13px;
            color:#6b7280;
            margin-bottom:14px;
        ">
            A new version of the File Manager is ready.
        </div>

        <div style="
            display:flex;
            gap:8px;
        ">
            <button
                id="pwaUpdateBtn"
                type="button"
                style="
                    flex:1;
                    border:0;
                    border-radius:12px;
                    padding:11px;
                    background:#007aff;
                    color:white;
                    font-weight:600;
                    cursor:pointer;
                "
            >
                Update
            </button>

            <button
                id="pwaUpdateLaterBtn"
                type="button"
                style="
                    flex:1;
                    border:0;
                    border-radius:12px;
                    padding:11px;
                    background:#e5e7eb;
                    color:#111827;
                    font-weight:600;
                    cursor:pointer;
                "
            >
                Later
            </button>
        </div>
    </div>
`;


document.body.appendChild(
    notice
);


const laterBtn =
    document.getElementById(
        "pwaUpdateLaterBtn"
    );


if (laterBtn) {

    laterBtn.addEventListener(
        "click",
        () => {

            notice.remove();

        }
    );

}


const updateBtn =
    document.getElementById(
        "pwaUpdateBtn"
    );


if (updateBtn) {

    updateBtn.addEventListener(
        "click",
        () => {

            const worker =
                reg.waiting;


            if (!worker) {

                notice.remove();

                return;

            }


            worker.postMessage({
                type:
                    "SKIP_WAITING"
            });

        }
    );

}
}

