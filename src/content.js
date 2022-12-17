let firefox = true;
if (typeof browser === "undefined") {
    browser = chrome
    firefox = false
}

function main() {
	console.log("Loading content script, everything is fine and dandy!");
    let p = document.querySelector("main > div > div > div > div")
    let c;
// loop through c to see if they are p elements or pre elements
    let page = []
    let first_time = true
    let id;
    document.body.appendChild(document.createElement(`div`)).setAttribute("id", "chat_history");
    let history_box = document.querySelector("#chat_history");

	//<polyline points="15 18 9 12 15 6">
	//<polyline points="9 18 15 12 9 6">
	/*
		The way that this new state works is by constantly updating and filling in the gaps.
		The length of an autosave should be short enough that in the time the user is flipping through the HTML, 
			they should traverse ALL of the possible nodes without us having to add listeners.
	 */
	let mirror_branch_state;
	mirror_branch_state = new TreeNode();

	/*
		mirror the state in a non-binary tree
		we use a class for convenience and namespace;
		to export to JSON, use the dedicated .toJSON() function 
	 */
	function TreeNode(data)
	{
		this.leaves = [];
		this.data = data;
		// instance 
		this.currentLeafIndex = -1;
	}

	TreeNode.prototype.getData = function()
	{
		return this.data;
	}

	TreeNode.prototype.getCurrentLeaf = function()
	{
		return this.leaves[this.currentLeafIndex];
	}

	TreeNode.prototype.getLeaves = function()
	{
		return this.leaves;
	}

	TreeNode.prototype.addLeaf = function(leaf)
	{
		this.leaves.push(leaf);
		this.currentLeafIndex++;
	}

	TreeNode.prototype.addLeafCurrentLeaf = function(leaf)
	{
		let currentLeaf = this.leaves[this.currentLeafIndex];
		if(currentLeaf)
		{
			currentLeaf.addLeaf(leaf);
		}
	}

	TreeNode.prototype.addLeafByData = function(data)
	{
		let leaf = new TreeNode(data);
		this.addLeaf(leaf);
	}

	TreeNode.prototype.setData = function(data)
	{
		this.data = data;
	}

	TreeNode.prototype.setCurrentLeafIndex = function(index)
	{
		this.currentLeafIndex = index;
	}

	// traverses the tree according to the current leaf indices
	// returns the data in an array, much like the old .convo field
	TreeNode.prototype.getCurrentData = function()
	{
		let data = [this.data];
		let currentLeaf = this.leaves[this.currentLeafIndex];
		let leafData = [];
		if(currentLeaf)
		{
			leafData = currentLeaf.getCurrentData();
		}
		return data.concat(leafData);
	}

	// return a primitive data version for storage
	TreeNode.prototype.toJSON = function()
	{
		let JSONObject = {data:this.data, leaves:[]};
		for(let index = 0, length = this.leaves.length; index < length; index++)
		{
			if(this.leaves[index])
			{
				JSONObject.leaves[index] = this.leaves[index].toJSON();
			}
			else 
			{
				console.warn(`TreeNode.toJSON: Empty object at index ${index}.`);
			}
		}
		return JSONObject;
	}

    function saveChildInnerHTML(parent, clone = true) { // generated by ChatGPT
        // Get the child elements of the parent
        let p1;
        if (clone) {
            p1 = parent.cloneNode(true)
            p1.setAttribute("style", "display: none;");
            history_box.innerHTML = "";
            history_box.appendChild(p1);
        } else {
            p1 = parent
        }
        var children = p1.children;

        // Create a string to store the innerHTML of each child
        var childInnerHTML = '';

        // Loop through each child element
        for (var i = 0; i < children.length; i++) {
            // Clone the child element
            var child = children[i];
            console.log(child)
            if (child.tagName == "PRE") {
                let div = child.firstChild.children[1]
                div.firstChild.classList.add('p-4')
                let text = div.innerHTML
                let clipboard = `<i class="fa-regular clipboard fa-clipboard"></i>`
                let copy_bar = `<div class="p-2 copy float-right">${clipboard} &nbsp; Copy code</div>`
                let template = `<pre>${copy_bar}<div>${text}</div></pre><br>`
                childInnerHTML += template;
            } else {
                // Remove the child's class attribute
                child.removeAttribute("class");

                // Recursively call the function on the child's children
                saveChildInnerHTML(child, false);

                // Add the child's innerHTML to the string
                childInnerHTML += child.outerHTML;
            }
        }

        return childInnerHTML;
    }

    function save_thread(human, h) {
        let text;
        if (human) {
            text = h.innerText // saves as plain text
			if(text.includes("Save & Submit\nCancel"))
			{
				// query the textarea instead 
				text = h.querySelector("textarea")?.value;
			}
            text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
        if (!human) {
            text = saveChildInnerHTML(h.firstChild.children[1].firstChild.firstChild) // saves as html
            if (h.classList.contains('text-red-500')){
                text = "ERROR"
            }
        }
        return text
    }

    function getDate() { // generated by ChatGPT
        var date = new Date();
        var options = {year: 'numeric', month: 'long', day: 'numeric'};
        return date.toLocaleString('default', options);
    }

    function getTime() { // generated by ChatGPT
        var currentDate = new Date();
        var options = {
            hour12: true,
            hour: "numeric",
            minute: "numeric"
        };
        var timeString = currentDate.toLocaleTimeString("default", options);
        return timeString
    }

    function generateUUID() {
        // create an array of possible characters for the UUID
        var possibleChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        // create an empty string that will be used to generate the UUID
        var uuid = "";

        // loop over the possible characters and append a random character to the UUID string
        for (var i = 0; i < 36; i++) {
            uuid += possibleChars.charAt(Math.floor(Math.random() * possibleChars.length));
        }

        // return the generated UUID
        return uuid;
    }


    function save_page() {
        c = p.children
        if (c.length > 2) {
            let t;
            browser.storage.local.get({threads: null}).then((result) => {
                t = result.threads
                page = [];
				let current_leaf = mirror_branch_state;
                for (let i = 0; i < c.length - 1; i++) {
                    let human = i % 2 === 0;
					let child = c[i];
                    let text = save_thread(human, child)
                    if (text === "ERROR" || text.includes(`<p>network error</p>`) || text.includes(`<p>Load failed</p>`) || text.includes(`<p>Error in body stream/p>`)) {
                        text = t[t.length - 1].convo[i]
                        if (!text.endsWith(`(error)`)) {
                            text = `${text}<br> (error)`
                        }
                    }
                    page.push(text);
					
					// mirror state;
					
					let elements = child.querySelectorAll("span");
					// get last element
					let spanText = elements[elements.length - 1]?.innerHTML; // html instead of text because it sometimes hides
					if(human)
					{
						// because there are now two spans being used for other stuff, but only for humans
						if(elements.length < 3) spanText = undefined;
					}
					
					let leafIndex = 0;
					if(spanText)
					{
						let spanNumber = Number(spanText.split("/")[0]);
						// sometimes spanText trawls up "!" that comes from content warning policy; just ignore that.
						if(!isNaN(spanNumber))
						{
							// remember array indices start at 0
							leafIndex = spanNumber - 1;
							console.log(leafIndex);
						}
					}
					current_leaf.setCurrentLeafIndex(leafIndex);
					if(leafIndex > -1)
					{
						let new_current_leaf = current_leaf.getCurrentLeaf();
						if(!new_current_leaf)
						{
							new_current_leaf = new TreeNode();
							// array.set in case we don't start at the beginning.
							// yes, that is a thing that happens
							current_leaf.getLeaves()[leafIndex] = new_current_leaf;
						}
						new_current_leaf.setData(text);
						current_leaf = new_current_leaf;
					}
                }
				console.log( mirror_branch_state.toJSON() );
                if (t !== null) {
                    if (first_time) {
                        id = generateUUID();
                        let thread = {date: getDate(), time: getTime(), convo: page, favorite: false, id: id, branch_state: mirror_branch_state.toJSON()}
                        t.push(thread)
                        first_time = false
                    } else {
                        let thread = {date: getDate(), time: getTime(), convo: page, favorite: false, id: id, branch_state: mirror_branch_state.toJSON()}
                        t[t.length - 1] = thread
                    }
                    browser.storage.local.set({threads: t})
                } else {
                    id = generateUUID()
                    let thread = {date: getDate(), time: getTime(), convo: page, favorite: false, id: id, branch_state: mirror_branch_state.toJSON()}
                    let t = [thread]
                    first_time = false
                    browser.storage.local.set({threads: t})
                }
            });
        }
    }

    document.addEventListener('keydown', function (event) { // generated by ChatGPT
        // Check if the pressed key was the Enter key
        if (event.key === 'Enter') {
            setTimeout(save_page, 500)
        }
    });

    let main = p

    //let stop_saving;
    let interval;
    const observer = new MutationObserver(function () { // created by chatGPT
        if (!timer_started) {
            interval = setInterval(save_page, 2000);
        }
        timer_started = true;
    });
    observer.observe(main, { // created by ChatGPT
        subtree: true,
        childList: true,
    });

    let reset = document.querySelector("nav").firstChild
    reset.addEventListener('click', function () {
        first_time = true;
		mirror_branch_state = new TreeNode();
    })
    let timer_started = false


    // BEGIN PDF/PNG/HTML DOWNLOAD BUTTONS
    function add_buttons(){ // generated by ChatGPT
        var nav = document.querySelector("nav");
        var pdf = document.createElement("a");
        pdf.id = 'download-pdf-button'
        pdf.onclick = () => {
            downloadThread({ as: Format.PDF });
        };
        pdf.setAttribute("class", "flex py-3 px-3 items-center gap-3 rounded-md hover:bg-gray-500/10 transition-colors duration-200 text-white cursor-pointer text-sm flex-shrink-0 border border-white/20");
        let pdf_svg = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`
        pdf.innerHTML = `${pdf_svg} Download PDF`;
        nav.insertBefore(pdf, nav.children[1]);

        let png = document.createElement("a");
        png.id = 'download-png-button'
        png.onclick = () => {
            downloadThread({ as: Format.PNG });
        }
        png.setAttribute("class", "flex py-3 px-3 items-center gap-3 rounded-md hover:bg-gray-500/10 transition-colors duration-200 text-white cursor-pointer text-sm flex-shrink-0 border border-white/20");
        let png_svg = `<svg xmlns="http://www.w3.org/2000/svg" style="fill: white" stroke="currentColor" width="24" height="25" viewBox="0 0 512 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM323.8 202.5c-4.5-6.6-11.9-10.5-19.8-10.5s-15.4 3.9-19.8 10.5l-87 127.6L170.7 297c-4.6-5.7-11.5-9-18.7-9s-14.2 3.3-18.7 9l-64 80c-5.8 7.2-6.9 17.1-2.9 25.4s12.4 13.6 21.6 13.6h96 32H424c8.9 0 17.1-4.9 21.2-12.8s3.6-17.4-1.4-24.7l-120-176zM112 192c26.5 0 48-21.5 48-48s-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48z"/></svg>`
        png.innerHTML = `${png_svg} Download PNG`;
        nav.insertBefore(png, nav.children[2]);

        let h = document.createElement("a");
        h.id = 'download-html-button'
        h.onclick = () => {
            sendRequest()
        }
        h.setAttribute("class", "flex py-3 px-3 items-center gap-3 rounded-md hover:bg-gray-500/10 transition-colors duration-200 text-white cursor-pointer text-sm flex-shrink-0 border border-white/20");
        let h_svg = `<svg xmlns="http://www.w3.org/2000/svg" style="fill: white" stroke="currentColor" width="24" height="25" viewBox="0 0 448 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M246.6 9.4c-12.5-12.5-32.8-12.5-45.3 0l-128 128c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 109.3V320c0 17.7 14.3 32 32 32s32-14.3 32-32V109.3l73.4 73.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-128-128zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64c0 53 43 96 96 96H352c53 0 96-43 96-96V352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V352z"/></svg>`
        h.innerHTML = `${h_svg} Share Page`;
        nav.insertBefore(h, nav.children[3]);
    }
    if (!firefox){
        add_buttons()
    }

    const Format = {
        PNG: "png",
        PDF: "pdf",
    };

    function getData() {
        const globalCss = getCssFromSheet(
            document.querySelector("link[rel=stylesheet]").sheet
        );
        const localCss =
            getCssFromSheet(
                document.querySelector(`style[data-styled][data-styled-version]`).sheet
            ) || "body{}";
        const data = {
            main: document.querySelector("main").outerHTML,
            // css: `${globalCss} /* GLOBAL-LOCAL */ ${localCss}`,
            globalCss,
            localCss,
        };
        return data;
    }

    async function sendRequest() {
        const data = getData();
        const uploadUrlResponse = await fetch(
            "https://chatgpt-static.s3.amazonaws.com/url.txt"
        );
        const uploadUrl = await uploadUrlResponse.text();
        fetch(uploadUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        })
            .then((response) => response.json())
            .then((data) => {
                window.open(data.url, "_blank");
            });
    }

    function handleImg(imgData) {
        const binaryData = atob(imgData.split("base64,")[1]);
        const data = [];
        for (let i = 0; i < binaryData.length; i++) {
            data.push(binaryData.charCodeAt(i));
        }
        const blob = new Blob([new Uint8Array(data)], { type: "image/png" });
        const url = URL.createObjectURL(blob);

        window.open(url, "_blank");

        //   const a = document.createElement("a");
        //   a.href = url;
        //   a.download = "chat-gpt-image.png";
        //   a.click();
    }
    function handlePdf(imgData, canvas, pixelRatio) {
        const { jsPDF } = window.jspdf;
        const orientation = canvas.width > canvas.height ? "l" : "p";
        var pdf = new jsPDF(orientation, "pt", [
            canvas.width / pixelRatio,
            canvas.height / pixelRatio,
        ]);
        var pdfWidth = pdf.internal.pageSize.getWidth();
        var pdfHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save("chat-gpt.pdf");
    }


    class Elements {
        constructor() {
            this.init();
        }
        init() {
            // this.threadWrapper = document.querySelector(".cdfdFe");
            this.spacer = document.querySelector(".w-full.h-48.flex-shrink-0");
            this.thread = document.querySelector(
                "[class*='react-scroll-to-bottom']>[class*='react-scroll-to-bottom']>div"
            );
            this.positionForm = document.querySelector("form").parentNode;
            // this.styledThread = document.querySelector("main");
            // this.threadContent = document.querySelector(".gAnhyd");
            this.scroller = Array.from(
                document.querySelectorAll('[class*="react-scroll-to"]')
            ).filter((el) => el.classList.contains("h-full"))[0];
            this.hiddens = Array.from(document.querySelectorAll(".overflow-hidden"));
            this.images = Array.from(document.querySelectorAll("img[srcset]"));
        }
        fixLocation() {
            this.hiddens.forEach((el) => {
                el.classList.remove("overflow-hidden");
            });
            this.spacer.style.display = "none";
            this.thread.style.maxWidth = "960px";
            this.thread.style.marginInline = "auto";
            this.positionForm.style.display = "none";
            this.scroller.classList.remove("h-full");
            this.scroller.style.minHeight = "100vh";
            this.images.forEach((img) => {
                const srcset = img.getAttribute("srcset");
                img.setAttribute("srcset_old", srcset);
                img.setAttribute("srcset", "");
            });
            //Fix to the text shifting down when generating the canvas
            document.body.style.lineHeight = "0.5";
        }
        restoreLocation() {
            this.hiddens.forEach((el) => {
                el.classList.add("overflow-hidden");
            });
            this.spacer.style.display = null;
            this.thread.style.maxWidth = null;
            this.thread.style.marginInline = null;
            this.positionForm.style.display = null;
            this.scroller.classList.add("h-full");
            this.scroller.style.minHeight = null;
            this.images.forEach((img) => {
                const srcset = img.getAttribute("srcset_old");
                img.setAttribute("srcset", srcset);
                img.setAttribute("srcset_old", "");
            });
            document.body.style.lineHeight = null;
        }
    }

    function downloadThread({ as = Format.PNG } = {}) {
        const elements = new Elements();
        elements.fixLocation();
        const pixelRatio = window.devicePixelRatio;
        const minRatio = as === Format.PDF ? 2 : 2.5;
        window.devicePixelRatio = Math.max(pixelRatio, minRatio);

        html2canvas(elements.thread, {
            letterRendering: true,
        }).then(async function (canvas) {
            elements.restoreLocation();
            window.devicePixelRatio = pixelRatio;
            const imgData = canvas.toDataURL("image/png");
            requestAnimationFrame(() => {
                if (as === Format.PDF) {
                    return handlePdf(imgData, canvas, pixelRatio);
                } else {
                    handleImg(imgData);
                }
            });
        });
    }
    function getCssFromSheet(sheet) {
        return Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join("");
    }
    function continue_convo(convo){
        const input = document.querySelector("textarea");
        const button = input.parentElement.querySelector("button");
        const intro = `The following is an array of a conversation between me and ChatGPT. Use it for context in the rest of the conversation. Be ready to edit and build upon the responses previously given by ChatGPT. Respond "ready!" if you understand the context. You do not need to say anything else. Conversation:`
        input.value = `${intro} ${convo}`;
        button.click();
    }

    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            console.log(request)
            if (request.type === "c_continue_convo") {
                console.log("message recieved!")
                continue_convo(JSON.stringify(request.convo))
            }
        }
    );
}

if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(main, 100);
}
else {
    document.addEventListener("DOMContentLoaded", main);
}