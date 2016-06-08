/*
 * Copyright (c) 2015 Memorial Sloan-Kettering Cancer Center.
 *
 * This library is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY, WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY OR FITNESS
 * FOR A PARTICULAR PURPOSE. The software and documentation provided hereunder
 * is on an 'as is' basis, and Memorial Sloan-Kettering Cancer Center has no
 * obligations to provide maintenance, support, updates, enhancements or
 * modifications. In no event shall Memorial Sloan-Kettering Cancer Center be
 * liable to any party for direct, indirect, special, incidental or
 * consequential damages, including lost profits, arising out of the use of this
 * software and its documentation, even if Memorial Sloan-Kettering Cancer
 * Center has been advised of the possibility of such damage.
 */

/*
 * This file is part of cBioPortal.
 *
 * cBioPortal is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
/**
 * Created by Karthik Kalletla on 4/6/16.
 */
'use strict';
(function(Vue, dc, iViz, $) {

  Vue.component('pieChart', {
    template: '<div id={{charDivId}} class="grid-item" class="study-view-dc-chart study-view-pie-main" ' +
    '@mouseenter="mouseEnter" @mouseleave="mouseLeave" ' +
    '@mouseover="mouseOver" ' +
    'style="height: 165px; width: 180px;">' +
    '<chart-operations :is-pie-chart="isPieChart" :display-name="displayName":show-table.sync="showTable" :show-operations="showOperations" :groupid="groupid" :reset-btn-id="resetBtnId" :chart="chartInst"></chart-operations>' +
    '<div class="dc-chart dc-pie-chart" :class="{view: !showTable}" align="center" style="float:none' +
    ' !important;" id={{chartId}} >' +
    /*'<p class="text-center">{{displayName}}</p>*/
    '</div>' +
    '<div id={{chartTableId}} :class="{view: showTable}"></div>'+
    '</div>',
    props: [
      'ndx', 'attributes', 'filters', 'groupid','data','options'
    ],
    data: function() {
      return {
        v: {},
        charDivId: 'chart-' + this.attributes.attr_id.replace(/\(|\)/g, "") +
        '-div',
        resetBtnId: 'chart-' + this.attributes.attr_id.replace(/\(|\)/g, "") +
        '-reset',
        chartId: 'chart-' + this.attributes.attr_id.replace(/\(|\)/g, ""),
        chartTableId : 'table-'+ this.attributes.attr_id.replace(/\(|\)/g, ""),
        displayName: this.attributes.display_name,
        chartInst: '',
        showOperations: false,
        fromWatch: false,
        fromFilter: false,
        cluster: '',
        _piechart:'',
        isPieChart:true,
        showTable:true

      }
    },
    watch: {
      'filters': function(newVal, oldVal) {
        if (!this.fromFilter) {
          this.fromWatch = true;
          if (newVal.length === oldVal.length) {
            if (newVal.length == 0) {
              this.chartInst.filterAll();
              dc.redrawAll(this.groupid)
            } else {
              var newFilters = $.extend(true, [], newVal);
              var exisitngFilters = $.extend(true, [], this.chartInst.filters());
              var temp = _.difference(exisitngFilters, newFilters);
              this.chartInst.filter(temp);
              dc.redrawAll(this.groupid)
            }
          }
        } else {
          this.fromFilter = false;
        }
      }
    },
    events: {
      'toTableView': function() {
        this._piechart.changeView(this,!this.showTable);
      },
      'closeChart':function(){
        $('#' +this.charDivId).qtip('destroy', true);
        this.$dispatch('close');
      }
    },
    methods: {
      mouseEnter: function() {
        this.showOperations = true;
      }, mouseLeave: function() {
        this.showOperations = false;
      },mouseOver : function(){
        this.$emit('initMainDivQtip');
      },initMainDivQtip : function(){
        this._piechart.initMainDivQtip();
      }
    },
    ready: function() {
      this.$once('initMainDivQtip',this.initMainDivQtip);
      var opts = {
        chartId : this.chartId,
        charDivId : this.charDivId,
        groupid : this.groupid,
        chartTableId : this.chartTableId,
        transitionDuration : iViz.opts.dc.transitionDuration,
        width:130,
        height:130
      };
      this._piechart = new iViz.view.component.pieChart();
      this.chartInst = this._piechart.init(this.ndx, this.attributes, opts);
      var self_ = this;
      this.chartInst.on('filtered', function(_chartInst, _filter) {
        if (!self_.fromWatch) {
          self_.fromFilter = true;
          var tempFilters_ = $.extend(true, [], self_.filters);
          tempFilters_ = iViz.shared.updateFilters(_filter, tempFilters_,
            self_.attributes.attr_id, self_.attributes.view_type);
          self_.filters = tempFilters_;
        } else {
          self_.fromWatch = false;
        }

        self_.$dispatch('update-filters')
      });
      this.$dispatch('data-loaded', true)
    }
  });
})(window.Vue, window.dc, window.iViz,
  window.$ || window.jQuery);
