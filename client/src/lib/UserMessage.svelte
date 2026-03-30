<script lang="ts">
import { slide } from "svelte/transition";
import * as Proto3 from '@clapshot_protobuf/typescript';
import '@fortawesome/fontawesome-free/css/all.min.css';

    interface Props {
        msg: Proto3.UserMessage;
    }

    let { msg }: Props = $props();
let showDetails: boolean = $state(false);

function isError(msg: Proto3.UserMessage): boolean {
    return msg.type == Proto3.UserMessage_Type.ERROR;
}

function msgTypeName(msg: Proto3.UserMessage): string {
    switch (msg.type) {
        case Proto3.UserMessage_Type.OK:       return 'OK';
        case Proto3.UserMessage_Type.ERROR:    return 'ERROR';
        case Proto3.UserMessage_Type.PROGRESS: return 'PROGRESS';
        default: return '';
    }
}

function dateObjToISO(d: Date|undefined): string {
    if (d == null) return '';
    var tzo = -d.getTimezoneOffset(),
        dif = tzo >= 0 ? '+' : '-',
        pad = function(num: number) { return (num < 10 ? '0' : '') + num; };

    return d.getFullYear() +
        '-' + pad(d.getMonth() + 1) +
        '-' + pad(d.getDate()) +
        ' ' + pad(d.getHours()) +
        ':' + pad(d.getMinutes()) +
        ':' + pad(d.getSeconds());
}
</script>

<div class="user-msg {isError(msg) ? 'msg-error' : 'msg-ok'}">
    <div class="msg-header">
        <span class="msg-type-badge {isError(msg) ? 'badge-error' : 'badge-ok'}">
            <i class="fas {isError(msg) ? 'fa-circle-exclamation' : 'fa-circle-check'} text-xs"></i>
            {msgTypeName(msg)}
        </span>

        {#if msg.refs?.mediaFileId}
            {#if isError(msg)}
                <span class="msg-file-id line-through opacity-40">{msg.refs.mediaFileId}</span>
            {:else}
                <a class="msg-file-link" href="/?vid={msg.refs.mediaFileId}">
                    <i class="fas fa-film text-[10px] mr-1"></i>{msg.refs.mediaFileId}
                </a>
            {/if}
        {/if}

        <span class="msg-date">{dateObjToISO(msg.created)}</span>
    </div>

    <div class="msg-body">
        <span class="msg-text">{msg.message}</span>

        {#if msg.details}
            <button
                class="details-toggle"
                onclick={() => showDetails = !showDetails}
                onkeyup={e => { if (e.key === 'Enter') showDetails = !showDetails; }}
            >
                <i class="fas {showDetails ? 'fa-chevron-down' : 'fa-chevron-right'} text-[10px] mr-1"></i>
                {showDetails ? 'Hide details' : 'Show details'}
            </button>

            {#if showDetails}
                <div class="msg-details" transition:slide="{{ duration: 200 }}">
                    {msg.details}
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
.user-msg {
    border-radius: 8px;
    border: 1px solid #1E2840;
    background: #111520;
    overflow: hidden;
    transition: border-color 150ms;
}
.user-msg:hover { border-color: #2A3550; }

.msg-error { border-left: 2px solid #F87171; }
.msg-ok    { border-left: 2px solid #34D399; }

.msg-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-bottom: 1px solid #1E2840;
    flex-wrap: wrap;
}

.msg-type-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 4px;
}
.badge-error { color: #F87171; background: rgba(248,113,113,0.1); }
.badge-ok    { color: #34D399; background: rgba(52,211,153,0.1); }

.msg-file-id {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.65rem;
    color: #3A4259;
}

.msg-file-link {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.65rem;
    color: #4F8EF7;
    text-decoration: none;
    transition: color 150ms;
}
.msg-file-link:hover { color: #7DAFFF; text-decoration: underline; }

.msg-date {
    font-size: 0.65rem;
    color: #3A4259;
    margin-left: auto;
    white-space: nowrap;
}

.msg-body {
    padding: 6px 10px 8px;
}

.msg-text {
    font-size: 0.78rem;
    color: #8A9BBD;
    display: block;
}

.details-toggle {
    display: flex;
    align-items: center;
    margin-top: 5px;
    font-size: 0.65rem;
    color: #F59E0B;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: color 150ms;
}
.details-toggle:hover { color: #FCD34D; }

.msg-details {
    margin-top: 6px;
    padding: 8px;
    background: #1C2234;
    border: 1px solid #2A3550;
    border-radius: 6px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.7rem;
    color: #8A9BBD;
    white-space: pre-wrap;
    word-break: break-all;
}
</style>
