/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Inject,
  Input,
  Optional,
  Output,
  ViewEncapsulation,
  ChangeDetectorRef,
} from '@angular/core';
import {DateAdapter, MAT_DATE_FORMATS, MatDateFormats} from '@angular/material/core';
import {MatCalendarCell} from './calendar-body';
import {createMissingDateImplError} from './datepicker-errors';


const DAYS_PER_WEEK = 7;


/**
 * An internal component used to display a single month in the datepicker.
 * @docs-private
 */
@Component({
  moduleId: module.id,
  selector: 'mat-month-view',
  templateUrl: 'month-view.html',
  exportAs: 'matMonthView',
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatMonthView<D> implements AfterContentInit {
  /**
   * The date to display in this month view (everything other than the month and year is ignored).
   */
  @Input()
  get activeDate(): D { return this._activeDate; }
  set activeDate(value: D) {
    let oldActiveDate = this._activeDate;
    this._activeDate =
        this._getValidDateOrNull(this._dateAdapter.deserialize(value)) || this._dateAdapter.today();
    if (!this._hasSameMonthAndYear(oldActiveDate, this._activeDate)) {
      this._init();
    }
  }
  private _activeDate: D;

  /** The currently selected date. */
  @Input()
  get selected(): D | null { return this._selected; }
  set selected(value: D | null) {
    this._selected = this._getValidDateOrNull(this._dateAdapter.deserialize(value));
    this._selectedDate = this._getDateInCurrentMonth(this._selected);
  }
  private _selected: D | null;

  /** Current start of interval. */
  @Input()
  get beginDate(): D | null { return this._beginDate; }
  set beginDate(value: D | null) {
    this._beginDate = this._getValidDateOrNull(this._dateAdapter.deserialize(value));
    this.updateRangeSpecificValues();
  }
  private _beginDate: D | null;

  /** Current end of interval. */
  @Input()
  get endDate(): D | null { return this._endDate; }
  set endDate(value: D | null) {
    this._endDate = this._getValidDateOrNull(this._dateAdapter.deserialize(value));
    this.updateRangeSpecificValues();
  }
  private _endDate: D | null;

  /** Current start of interval. */
  @Input()
  get beginCollDate(): D | null { return this._beginCollDate; }
  set beginCollDate(value: D | null) {
    this._beginCollDate = this._getValidDateOrNull(this._dateAdapter.deserialize(value));
    this.updateCollRangeSpecificValues();
  }
  private _beginCollDate: D | null;

  /** Current end of interval. */
  @Input()
  get endCollDate(): D | null { return this._endCollDate; }
  set endCollDate(value: D | null) {
    this._endCollDate = this._getValidDateOrNull(this._dateAdapter.deserialize(value));
    this.updateCollRangeSpecificValues();
  }
  private _endCollDate: D | null;

  /** Allow selecting range of dates. */
  @Input() rangeMode = false;

  /** A function used to filter which dates are selectable. */
  @Input() dateFilter: (date: D) => boolean;

  /** Emits when a new date is selected. */
  @Output() selectedChange = new EventEmitter<D | null>();

  /** Emits when any date is selected. */
  @Output() _userSelection = new EventEmitter<void>();

  /** The label for this month (e.g. "January 2017"). */
  _monthLabel: string;

  /** Grid of calendar cells representing the dates of the month. */
  _weeks: MatCalendarCell[][];

  /** The number of blank cells in the first row before the 1st of the month. */
  _firstWeekOffset: number;

  /**
   * The date of the month that the currently selected Date falls on.
   * Null if the currently selected Date is in another month.
   */
  _selectedDate: number | null;

  /** First day of interval. */
  _beginDateNumber: number | null;

  /* Last day of interval. */
  _endDateNumber: number | null;

  _beginCollDateNumber: number | null;
  _endCollDateNumber: number | null;

  /** Whenever full month is inside dates interval. */
  _rangeFull: boolean | null = false;

  /** Whenever user already selected start of dates interval. */
  // @Input()
  // private _beginDateSelected = false;

  /** The date of the month that today falls on. Null if today is in another month. */
  _todayDate: number | null;

  /** The names of the weekdays. */
  _weekdays: {long: string, narrow: string}[];

  constructor(@Optional() public _dateAdapter: DateAdapter<D>,
              @Optional() @Inject(MAT_DATE_FORMATS) private _dateFormats: MatDateFormats,
              private _changeDetectorRef: ChangeDetectorRef) {
    if (!this._dateAdapter) {
      throw createMissingDateImplError('DateAdapter');
    }
    if (!this._dateFormats) {
      throw createMissingDateImplError('MAT_DATE_FORMATS');
    }

    const firstDayOfWeek = this._dateAdapter.getFirstDayOfWeek();
    const narrowWeekdays = this._dateAdapter.getDayOfWeekNames('narrow');
    const longWeekdays = this._dateAdapter.getDayOfWeekNames('long');

    // Rotate the labels for days of the week based on the configured first day of the week.
    let weekdays = longWeekdays.map((long, i) => {
      return {long, narrow: narrowWeekdays[i]};
    });
    this._weekdays = weekdays.slice(firstDayOfWeek).concat(weekdays.slice(0, firstDayOfWeek));

    this._activeDate = this._dateAdapter.today();
  }

  ngAfterContentInit(): void {
    this._init();
  }

  _getDateInstanceFromSelectedDate(date: number) {
      const selectedYear = this._dateAdapter.getYear(this.activeDate);
      const selectedMonth = this._dateAdapter.getMonth(this.activeDate);
      return this._dateAdapter.createDate(selectedYear, selectedMonth, date);
  }

  /** Handles when a new date is selected. */
  _dateSelected(date: number) {
    const selectedDate = this._getDateInstanceFromSelectedDate(date);
    if (this.rangeMode) {
      this.selectedChange.emit(selectedDate);
      // if (!this._beginDateSelected) { // At first click emit the same start and end of interval
      //   this._beginDateSelected = true;
      //
      // } else {
      //   this._beginDateSelected = false;
      //   this.selectedChange.emit(selectedDate);
      //   this._userSelection.emit();
      // }
    } else if (this._selectedDate != date) {
      this.selectedChange.emit(selectedDate);
      this._userSelection.emit();
    }
  }

  /** Initializes this month view. */
  _init() {
    this.updateRangeSpecificValues();
    this.updateCollRangeSpecificValues();
    this._selectedDate = this._getDateInCurrentMonth(this.selected);
    this._todayDate = this._getDateInCurrentMonth(this._dateAdapter.today());
    this._monthLabel =
        this._dateAdapter.getMonthNames('short')[this._dateAdapter.getMonth(this.activeDate)]
            .toLocaleUpperCase();

    let firstOfMonth = this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),
        this._dateAdapter.getMonth(this.activeDate), 1);
    this._firstWeekOffset =
        (DAYS_PER_WEEK + this._dateAdapter.getDayOfWeek(firstOfMonth) -
         this._dateAdapter.getFirstDayOfWeek()) % DAYS_PER_WEEK;

    this._createWeekCells();
    this._changeDetectorRef.markForCheck();
  }

  /** Creates MatCalendarCells for the dates in this month. */
  private _createWeekCells() {
    let daysInMonth = this._dateAdapter.getNumDaysInMonth(this.activeDate);
    let dateNames = this._dateAdapter.getDateNames();
    this._weeks = [[]];
    for (let i = 0, cell = this._firstWeekOffset; i < daysInMonth; i++, cell++) {
      if (cell == DAYS_PER_WEEK) {
        this._weeks.push([]);
        cell = 0;
      }
      let date = this._dateAdapter.createDate(
          this._dateAdapter.getYear(this.activeDate),
          this._dateAdapter.getMonth(this.activeDate), i + 1);
      let enabled = !this.dateFilter ||
          this.dateFilter(date);
      let ariaLabel = this._dateAdapter.format(date, this._dateFormats.display.dateA11yLabel);
      this._weeks[this._weeks.length - 1]
          .push(new MatCalendarCell(i + 1, dateNames[i], ariaLabel, enabled));
    }
  }

  /**
   * Gets the date in this month that the given Date falls on.
   * Returns null if the given Date is in another month.
   */
  private _getDateInCurrentMonth(date: D | null): number | null {
    return date && this._hasSameMonthAndYear(date, this.activeDate) ?
        this._dateAdapter.getDate(date) : null;
  }

  /** Checks whether the 2 dates are non-null and fall within the same month of the same year. */
  private _hasSameMonthAndYear(d1: D | null, d2: D | null): boolean {
    return !!(d1 && d2 && this._dateAdapter.getMonth(d1) == this._dateAdapter.getMonth(d2) &&
              this._dateAdapter.getYear(d1) == this._dateAdapter.getYear(d2));
  }

  /**
   * @param obj The object to check.
   * @returns The given object if it is both a date instance and valid, otherwise null.
   */
  private _getValidDateOrNull(obj: any): D | null {
    return (this._dateAdapter.isDateInstance(obj) && this._dateAdapter.isValid(obj)) ? obj : null;
  }

  /** Updates range full parameter on each begin or end of interval update.
   * Necessary to display calendar-body correctly
   */
  private updateRangeSpecificValues(): void {
    if (this.rangeMode) {
      this._beginDateNumber = this._getDateInCurrentMonth(this._beginDate);
      this._endDateNumber = this._getDateInCurrentMonth(this._endDate);
      this._rangeFull = this.beginDate && this.endDate && !this._beginDateNumber &&
        !this._endDateNumber &&
        this._dateAdapter.compareDate(this.beginDate, this.activeDate) <= 0 &&
        this._dateAdapter.compareDate(this.activeDate, this.endDate) <= 0;
    } else {
      this._beginDateNumber = this._endDateNumber = null;
      this._rangeFull = false;
    }
  }

  private updateCollRangeSpecificValues(): void {
    if (this.rangeMode) {
      this._beginCollDateNumber = this._getDateInCurrentMonth(this._beginCollDate);
      this._endCollDateNumber = this._getDateInCurrentMonth(this._endCollDate);
      this._rangeFull = this.beginDate && this.endDate && !this._beginCollDateNumber &&
        !this._endCollDateNumber &&
        this._dateAdapter.compareDate(this.beginCollDate, this.activeDate) <= 0 &&
        this._dateAdapter.compareDate(this.activeDate, this.endCollDate) <= 0;
    } else {
      this._beginCollDateNumber = this._endCollDateNumber = null;
      this._rangeFull = false;
    }
  }
}
