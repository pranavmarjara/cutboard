<script lang="ts">
    import { flushSync, untrack } from 'svelte';

import { scale, slide } from "svelte/transition";
import Avatar from '@/lib/Avatar.svelte';
import { curUserId, curUserIsAdmin, allComments, curSubtitle, curVideo } from '@/stores';
import * as Proto3 from '@clapshot_protobuf/typescript';
import { t } from '@/i18n';


    interface Props {
        indent?: number;
        comment: Proto3.Comment;
        ondisplaycomment?: (event: {timecode: string, drawing?: string, subtitleId?: string}) => void;
        ondeletecomment?: (event: {id: string}) => void;
        onreplytocomment?: (event: {parentId: string, commentText: string, subtitleId?: string}) => void;
        oneditcomment?: (event: {id: string, comment_text: string}) => void;
    }

    let { indent = 0, comment, ondisplaycomment, ondeletecomment, onreplytocomment, oneditcomment }: Props = $props();

let editing = $state(false);
let showActions: boolean = $state(false);

let showReply: boolean = $state(false);
let replyInput: HTMLInputElement | undefined = $state();

let commentText = $state(untrack(() => comment.comment));

$effect(() => {
    commentText = comment.comment;
});

function onTimecodeClick(tc: string) {
    if (ondisplaycomment) ondisplaycomment({
        timecode: tc,
        drawing: comment.drawing,
        subtitleId: comment.subtitleId
    });
}

function onClickDeleteComment() {
    var result = confirm($t('comments.deleteConfirm'));
    if (result && ondeletecomment) {
        ondeletecomment({'id': comment.id});
    }
}

function onReplySubmit() {
    if (replyInput && replyInput.value != "" && onreplytocomment)
    {
        onreplytocomment({
            parentId: comment.id,
            commentText: replyInput.value,
            subtitleId: $curSubtitle?.id
        });
        replyInput.value = "";
        showReply = false;
    }
}

function callFocus(elem: HTMLElement) {
    elem.focus();
}

function onEditFieldKeyDown(e: KeyboardEvent) {
    if ((e.key == "Enter" && !e.shiftKey) || e.key == "Escape") {
        e.preventDefault();
        e.stopPropagation();
        flushSync(() => {
            editing = false;
        });
        commentText = commentText.trim();
        if (commentText != "" && oneditcomment) {
            comment.comment = commentText;
            oneditcomment({'id': comment.id, 'comment_text': commentText});
        }
    }
}

function onEditFieldBlur() {
    if (editing) {
        editing = false;
        commentText = commentText.trim();
        comment.comment = commentText;
    }
}

function hasChildren(): boolean {
    return $allComments.filter(c => c.comment.parentId == comment.id).length > 0;
}

function getSubtitleLanguage(subtitleId: string): string {
    let sub = $curVideo?.subtitles.find(s => s.id == subtitleId);
    return sub ? sub.languageCode.toUpperCase() : "";
}

function onClickShare() {
    try {
        const base = window.location.href.split('#')[0];
        const url = `${base}#comment_${comment.id}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                alert($t('comments.linkCopied'));
            }).catch(() => { alert($t('comments.copyLink') + ": " + url); });
        } else { alert($t('comments.copyLink') + ": " + url); }
    } catch (e) {
        console.error('Failed to copy link', e);
    }
}

</script>

<div transition:scale
    id="comment_card_{comment.id}"
    class="comment-card {!!comment.timecode ? 'clickable' : ''}"
    style="margin-left: {indent * 1.25}rem"
    tabindex="0"
    role="link"
    onfocus={() => showActions=true}
    onmouseenter={() => showActions=true}
    onmouseleave={() => showActions=false}
    onclick={() => {if (comment.timecode) onTimecodeClick(comment.timecode);}}
    onkeydown={(e) => {
        if (e.key == "Escape") { editing = false; }
        else if (e.key == "Enter") { if (comment.timecode) onTimecodeClick(comment.timecode); }
    }}
>
    <!-- Header: avatar + author + timecode -->
    <div class="comment-header">
        <div class="comment-avatar">
            <Avatar username={comment.userId || comment.usernameIfnull} />
        </div>
        <div class="flex flex-col flex-1 min-w-0">
            <span class="comment-author">{comment.usernameIfnull}</span>
            {#if comment.timecode}
                <button
                    class="comment-timecode"
                    onclick={(e) => { e.stopPropagation(); onTimecodeClick(comment.timecode!); }}
                    title="Jump to this time"
                >
                    <i class="fas fa-clock text-[10px] mr-1 opacity-60"></i>{comment.timecode}
                </button>
            {/if}
        </div>
        {#if comment.subtitleId || comment.subtitleFilenameIfnull}
            <span class="subtitle-badge">
                {#if comment.subtitleId}
                    {getSubtitleLanguage(comment.subtitleId)}
                {:else}
                    <span class="line-through opacity-40" title={comment.subtitleFilenameIfnull}>SUB</span>
                {/if}
            </span>
        {/if}
    </div>

    <!-- Body -->
    <div class="comment-body">
        {#if editing}
            <textarea
                class="comment-edit-area"
                rows={3}
                use:callFocus
                bind:value={commentText}
                onkeydown={onEditFieldKeyDown}
                onblur={onEditFieldBlur}
            ></textarea>
        {:else}
            <p class="comment-text hyphenate">
                {comment.comment}
                {#if comment.edited}
                    <span class="edited-badge">{$t('comments.editedSuffix')}</span>
                {/if}
            </p>
        {/if}

        {#if comment.drawing}
            <div class="drawing-indicator">
                <i class="fas fa-pen-nib text-[10px] mr-1"></i>
                <span class="text-[10px]">Drawing attached</span>
            </div>
        {/if}
    </div>

    <!-- Actions (hover) -->
    {#if showActions}
    <div class="comment-actions" transition:slide="{{ duration: 180 }}">
        <button
            class="action-btn action-btn-ghost"
            title={$t('comments.copyLink')}
            aria-label={$t('comments.copyLink')}
            onclick={(e) => { e.stopPropagation(); onClickShare(); }}
        >
            <i class="fas fa-link text-[10px]"></i>
        </button>

        <div class="flex gap-1.5 ml-auto">
            <button
                class="action-btn action-btn-primary"
                onclick={(e) => { e.stopPropagation(); showReply = !showReply; }}
            >
                <i class="fas fa-reply text-[10px] mr-1"></i>
                {$t('comments.reply')}
            </button>
            {#if comment.userId == $curUserId || $curUserIsAdmin}
                <button
                    class="action-btn action-btn-ghost"
                    onclick={(e) => { e.stopPropagation(); editing = true; }}
                >
                    <i class="fas fa-pen text-[10px] mr-1"></i>
                    {$t('comments.edit')}
                </button>
                {#if !hasChildren()}
                    <button
                        class="action-btn action-btn-danger"
                        onclick={(e) => { e.stopPropagation(); onClickDeleteComment(); }}
                    >
                        <i class="fas fa-trash text-[10px] mr-1"></i>
                        {$t('comments.deleteShort')}
                    </button>
                {/if}
            {/if}
        </div>
    </div>
    {/if}

    <!-- Reply input -->
    {#if showReply}
    <form class="reply-form" onsubmit={(e) => {e.preventDefault(); onReplySubmit();}}>
        <input
            class="reply-input"
            type="text"
            placeholder={$t('comments.yourReply')}
            use:callFocus
            bind:this={replyInput}
            onblur={() => showReply = false}
        />
        <button type="submit" class="reply-send-btn">
            <i class="fas fa-paper-plane text-xs"></i>
        </button>
    </form>
    {/if}
</div>


<style>
.comment-card {
    position: relative;
    border-radius: 10px;
    background: #111520;
    border: 1px solid #1E2840;
    overflow: hidden;
    transition: border-color 150ms ease, background 150ms ease;
    cursor: default;
}

.comment-card.clickable {
    cursor: pointer;
}

.comment-card.clickable:hover {
    background: #141927;
    border-color: #2A3550;
}

.comment-card:focus {
    outline: none;
    border-color: #4F8EF7;
    box-shadow: 0 0 0 2px rgba(79,142,247,0.2);
}

.comment-header {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 10px 6px;
}

.comment-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
}

.comment-author {
    font-size: 0.75rem;
    font-weight: 600;
    color: #8A9BBD;
    line-height: 1.2;
}

.comment-timecode {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.65rem;
    color: #F59E0B;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: color 150ms;
    text-align: left;
}
.comment-timecode:hover {
    color: #FCD34D;
}

.subtitle-badge {
    font-size: 0.6rem;
    font-weight: 700;
    color: #6B7A99;
    background: #1E2840;
    padding: 1px 5px;
    border-radius: 4px;
    flex-shrink: 0;
}

.comment-body {
    padding: 0 10px 8px;
}

.comment-text {
    font-size: 0.8rem;
    line-height: 1.5;
    color: #C8D3E8;
}

.edited-badge {
    font-size: 0.65rem;
    color: #3A4259;
    font-style: italic;
    margin-left: 4px;
}

.drawing-indicator {
    display: flex;
    align-items: center;
    color: #6B7A99;
    margin-top: 4px;
    font-size: 0.65rem;
}

.comment-edit-area {
    width: 100%;
    background: #1C2234;
    border: 1px solid #2A3550;
    border-radius: 6px;
    color: #C8D3E8;
    padding: 6px 8px;
    font-size: 0.8rem;
    resize: none;
    outline: none;
    font-family: inherit;
    transition: border-color 150ms;
}
.comment-edit-area:focus {
    border-color: #4F8EF7;
}

.comment-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-top: 1px solid #1E2840;
    background: rgba(0,0,0,0.15);
}

.action-btn {
    display: flex;
    align-items: center;
    font-size: 0.7rem;
    font-weight: 500;
    padding: 3px 7px;
    border-radius: 5px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
}
.action-btn-ghost {
    background: transparent;
    color: #6B7A99;
    border: 1px solid #2A3550;
}
.action-btn-ghost:hover {
    background: #1E2840;
    color: #C8D3E8;
}
.action-btn-primary {
    background: rgba(79,142,247,0.1);
    color: #4F8EF7;
    border: 1px solid rgba(79,142,247,0.2);
}
.action-btn-primary:hover {
    background: rgba(79,142,247,0.2);
}
.action-btn-danger {
    background: transparent;
    color: #F87171;
    border: 1px solid rgba(248,113,113,0.2);
}
.action-btn-danger:hover {
    background: rgba(248,113,113,0.1);
}

.reply-form {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px 8px;
    border-top: 1px solid #1E2840;
}

.reply-input {
    flex: 1;
    background: #1C2234;
    border: 1px solid #2A3550;
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 0.75rem;
    color: #C8D3E8;
    outline: none;
    font-family: inherit;
    transition: border-color 150ms;
}
.reply-input:focus { border-color: #4F8EF7; }
.reply-input::placeholder { color: #3A4259; }

.reply-send-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(79,142,247,0.15);
    color: #4F8EF7;
    border: 1px solid rgba(79,142,247,0.2);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms;
    flex-shrink: 0;
}
.reply-send-btn:hover {
    background: rgba(79,142,247,0.25);
}

.hyphenate {
    -webkit-hyphens: auto;
    -moz-hyphens: auto;
    -ms-hyphens: auto;
    hyphens: auto;
    word-break: break-word;
}
</style>
