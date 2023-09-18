import CategorySelect from "./CategorySelect.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import Template from "./Template.jsx";
import {copyTextToClipboard, findVariables, replaceVariables} from "./js/utils.js";
import {useEffect, useRef, useState} from "react";
import Toast from "./Toast";

export default function MainContent(props) {
    const templates = props.prompts;

    const [modalVisible, setModalVisible] = useState(false);
    const [variables, setVariables] = useState([]);
    const [promptText, setPromptText] = useState("");
    const [textareaValues, setTextareaValues] = useState(Array(variables.length).fill(''));

    const [showToastMessage, setShowToastMessage] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    function getVarsFromModal(vars, text) {
        setVariables(vars);
        setPromptText(text)
        setModalVisible(true);
    }

    function closeModal() {
        document.getElementById("var_modal").checked = false;
        setTimeout(()=>setModalVisible(false), 100); // to allow for cool animation
    }

    function showToast(message) {
        setShowToastMessage(true);
        setToastMessage(message);

        setTimeout(() => {
            setShowToastMessage(false);
            setToastMessage("");
        }, 3000);
    }
    function usePrompt(text, varsFilledIn = true){
        const vars = varsFilledIn ? findVariables(text) : []; // so if the chosen prompt has a variable within {{}}
        console.log(vars)
        if (vars.length > 0) {
            getVarsFromModal(vars, text);
            return "";
        }
        copyTextToClipboard(text)
        showToast("Prompt Copied to Clipboard")
    }

    const modalRef = useRef(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (modalVisible && e.key === "Enter") {
                // Check if Enter key is pressed
                e.preventDefault(); // Prevent the default Enter behavior (e.g., form submission)
                usePrompt(replaceVariables(promptText, textareaValues), false);
                closeModal();
            }
        };

        const modalContainer = modalRef.current;

        if (modalContainer) {
            modalContainer.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            if (modalContainer) {
                modalContainer.removeEventListener("keydown", handleKeyDown);
            }
        };
    }, [modalVisible, textareaValues]);


    return (
        <>
        <div className="flex flex-col w-4/5">
            <div className="sticky flex p-4 align-middle justify-center">
                <div className="grow mr-3">
                    <CategorySelect categories={props.categories}/>
                </div>
                <div className="flex flex-col justify-center align-middle">
                    <ThemeToggle />
                </div>
            </div>
            {templates && (
                <div className="h-full overflow-y-auto">
                    <ul className="flex flex-col mr-8" id="templates">
                        {templates.map(
                            (template) => (
                                <Template setPrompts={props.setPrompts} categories={props.categories} onClick={() => usePrompt(template.text)} template={template} key={template.id}></Template>
                            )
                        )}
                    </ul>
                </div>
            )}
        </div>

        {modalVisible && (
            <>
            <input defaultChecked type="checkbox" id="var_modal" className="modal-toggle hidden" />
            <div className="modal" ref={modalRef}>
                <div className="modal-box">
                    {variables.map((variable, index) => (
                        <div key={index}>
                        <div className="text-sm font-bold py-3">
                            {variable}
                        </div>
                        <textarea
                            autoFocus={index===0}
                            className="textarea textarea-bordered w-full h-[25px]"
                            placeholder={`Enter value for ${variable}...`}
                            value={textareaValues[index]} // Use value instead of defaultValue
                            onChange={(e) => {
                            const newValues = [...textareaValues];
                            newValues[index] = e.target.value;
                            setTextareaValues(newValues);
                            }}
                        ></textarea>
                        </div>
                    ))}
                    <div className="modal-action">
                        <button onClick={() => {usePrompt(replaceVariables(promptText, textareaValues), false); closeModal()}} id="save-vars" className="btn">
                            Copy
                        </button>
                    </div>
                </div>
                <div className="modal-backdrop">
                    <button onClick={closeModal}>Close</button>
                </div>
            </div>
            </>
        )}

        {showToastMessage && <Toast message={toastMessage} />}
        </>
    );
}