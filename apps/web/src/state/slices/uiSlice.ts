import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface UiState {
  isDailyPopupOpen: boolean;
  activeModal: string | null;
  resultStepIndex: number;
}

const initialState: UiState = {
  isDailyPopupOpen: false,
  activeModal: null,
  resultStepIndex: 0,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setDailyPopupOpen(state, action: PayloadAction<boolean>) {
      state.isDailyPopupOpen = action.payload;
    },
    setActiveModal(state, action: PayloadAction<string | null>) {
      state.activeModal = action.payload;
    },
    setResultStepIndex(state, action: PayloadAction<number>) {
      state.resultStepIndex = action.payload;
    },
  },
});

export const { setDailyPopupOpen, setActiveModal, setResultStepIndex } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
