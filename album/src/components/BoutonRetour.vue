<template>
    <button class="btn-retour" @click="$router.back()">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
        </svg>
    </button>
</template>

<style scoped>
.btn-retour {
    position: fixed;
    top: 16px;
    left: 176px;
    background: #3355cc;
    border: none;
    color: white;
    width: 48px;
    height: 48px;
    border-radius: 10px;
    font-size: 1.6rem;
    padding: 10px;
    cursor: pointer;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}
.btn-retour:hover { background: #2244bb; }
</style>
