<script lang="ts">
    import { preventDefault } from 'svelte/legacy';

import '@fortawesome/fontawesome-free/css/all.min.css';
import { fade } from "svelte/transition";

import { videoIsReady } from '@/stores';
import { t } from '@/i18n';


interface Props {
    onbuttonclicked?: (event: {action: string, comment_text?: string, is_timed?: boolean, is_draw_mode?: boolean, color?: string}) => void;
}

let { onbuttonclicked }: Props = $props();

let inputText: any = $state();
let drawMode = $state(false);
let timedComment = $state(true);
let curColor = $state("red");

export function forceDrawMode(on: boolean) {
    drawMode = on;
}

function sendDrawModeToParent() {
    if (onbuttonclicked) onbuttonclicked({'action': 'draw', 'is_draw_mode': drawMode});
}
function onClickSend() {
    if (onbuttonclicked) onbuttonclicked({'action': 'send', 'comment_text': inputText, 'is_timed': timedComment});
    inputText = "";
    drawMode = false;
    sendDrawModeToParent();
}
function onClickDraw() {
    drawMode = !drawMode;
    if (drawMode) { timedComment = true; }
    sendDrawModeToParent();
}
function onColorSelected(c: string) {
    curColor = c;
    if (onbuttonclicked) onbuttonclicked({'action': 'color_select', 'color': c});
}
function onUndoRedo(is_undo: boolean) {
    if (is_undo && onbuttonclicked) {
        onbuttonclicked({'action': 'undo'});
    } else if (!is_undo && onbuttonclicked) {
        onbuttonclicked({'action': 'redo'});
    }
}

function onTextChange(e: any) {
    if (e.target.value.length > 0 && onbuttonclicked) {
        onbuttonclicked({'action': 'text_input'});
    }
    return false;
}

const COLORS = [
    { name: "red",    hex: "#EF4444" },
    { name: "green",  hex: "#22C55E" },
    { name: "blue",   hex: "#3B82F6" },
    { name: "cyan",   hex: "#06B6D4" },
    { name: "yellow", hex: "#EAB308" },
    { name: "black",  hex: "#111111" },
    { name: "white",  hex: "#F8FAFC" },
];
</script>


<div class="comment-input-wrapper">
    <!-- Draw mode toolbar -->
    {#if drawMode}
        <div class="draw-toolbar" transition:fade="{{duration: 150}}">
            <button
                type="button"
                class="draw-tool-btn"
                title={$t('comments.undo')}
                aria-label={$t('comments.undo')}
                onclick={() => onUndoRedo(true)}
            >
                <i class="fas fa-undo text-xs"></i>
            </button>
            <button
                type="button"
                class="draw-tool-btn"
                title={$t('comments.redo')}
                aria-label={$t('comments.redo')}
                onclick={() => onUndoRedo(false)}
            >
                <i class="fas fa-redo text-xs"></i>
            </button>
            <div class="color-divider"></div>
            {#each COLORS as c}
                <button
                    type="button"
                    class="color-swatch {curColor === c.name ? 'selected' : ''}"
                    style="background: {c.hex};"
                    aria-label="Select {c.name} color"
                    onclick={() => onColorSelected(c.name)}
                ></button>
            {/each}
        </div>
    {/if}

    <!-- Main input bar -->
    <form onsubmit={preventDefault(onClickSend)} class="input-bar">
        <input
            bind:value={inputText}
            oninput={onTextChange}
            class="comment-text-input"
            placeholder={timedComment ? $t('comments.placeholderTimed') : $t('comments.placeholderUntimed')}
        />

        {#if $videoIsReady}
            <button
                type="button"
                id="timedCommentButton"
                title={$t('comments.timedToggleTitle')}
                class="icon-btn {timedComment ? 'icon-btn-active-amber' : 'icon-btn-muted'}"
                disabled={drawMode}
                onclick={() => timedComment = !timedComment}
            >
                <span class="fa-stack fa-xs" style="width:1.2em; height:1.2em;">
                    <i class="fa-solid fa-stopwatch fa-stack-2x" style="font-size:1em;"></i>
                    {#if !timedComment}
                        <i class="fa-solid fa-x fa-stack-2x text-red-500" style="font-size:0.7em;"></i>
                    {/if}
                </span>
            </button>

            <button
                type="button"
                onclick={onClickDraw}
                class="icon-btn {drawMode ? 'icon-btn-active-blue' : 'icon-btn-muted'}"
                title={$t('comments.drawOnVideo')}
                aria-label={$t('comments.drawOnVideo')}
            >
                <i class="fas fa-pen-fancy text-xs"></i>
            </button>
        {/if}

        <button
            type="submit"
            id="sendButton"
            disabled={!inputText && !drawMode}
            class="send-btn"
        >
            <i class="fas fa-paper-plane text-xs mr-1.5"></i>
            {$t('comments.send')}
        </button>
    </form>
</div>


<style>
.comment-input-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0;
}

.draw-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: #111520;
    border: 1px solid #1E2840;
    border-bottom: none;
    border-radius: 10px 10px 0 0;
}

.draw-tool-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: transparent;
    border: 1px solid #2A3550;
    color: #6B7A99;
    cursor: pointer;
    transition: all 150ms ease;
}
.draw-tool-btn:hover {
    background: #1E2840;
    color: #C8D3E8;
}

.color-divider {
    width: 1px;
    height: 20px;
    background: #2A3550;
    margin: 0 4px;
}

.color-swatch {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 150ms ease, border-color 150ms ease;
    flex-shrink: 0;
}
.color-swatch:hover { transform: scale(1.15); }
.color-swatch.selected {
    border-color: #C8D3E8;
    transform: scale(1.1);
    box-shadow: 0 0 0 2px rgba(200,211,232,0.3);
}

.input-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #111520;
    border: 1px solid #1E2840;
    border-radius: 10px;
    padding: 6px 8px;
    transition: border-color 150ms ease;
}
.input-bar:focus-within {
    border-color: #2A3550;
}

.comment-text-input {
    flex: 1;
    background: #1C2234;
    border: 1px solid #1E2840;
    border-radius: 7px;
    padding: 7px 12px;
    font-size: 0.82rem;
    color: #C8D3E8;
    outline: none;
    font-family: inherit;
    transition: border-color 150ms ease;
    min-width: 0;
}
.comment-text-input:focus {
    border-color: #4F8EF7;
    background: #1E2840;
}
.comment-text-input::placeholder { color: #3A4259; }

.icon-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
}
.icon-btn-muted {
    background: transparent;
    color: #3A4259;
    border-color: #1E2840;
}
.icon-btn-muted:hover {
    background: #1E2840;
    color: #6B7A99;
}
.icon-btn-active-amber {
    background: rgba(245,158,11,0.1);
    color: #F59E0B;
    border-color: rgba(245,158,11,0.25);
}
.icon-btn-active-amber:hover {
    background: rgba(245,158,11,0.2);
}
.icon-btn-active-blue {
    background: rgba(79,142,247,0.15);
    color: #4F8EF7;
    border-color: rgba(79,142,247,0.3);
}
.icon-btn-active-blue:hover {
    background: rgba(79,142,247,0.25);
}
.icon-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

.send-btn {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 14px;
    background: linear-gradient(135deg, #EC4899, #8B5CF6, #3B82F6);
    color: white;
    border: none;
    border-radius: 7px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
    flex-shrink: 0;
}
.send-btn:hover {
    filter: brightness(1.12);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(139,92,246,0.35);
}
.send-btn:active {
    transform: translateY(0);
    filter: brightness(0.95);
}
#sendButton:disabled {
    opacity: 0.4;
    background: #2A3550;
    transform: none;
    box-shadow: none;
    cursor: not-allowed;
}
</style>
