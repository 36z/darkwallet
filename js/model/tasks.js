'use strict';

define(function() {

/**
 * Pending tasks.
 * @param {Object} store Object store
 * @constructor
 */
function Tasks(store) {
  this.store = store;
  this.tasks = this.store.init('tasks', {});
}

/**
 * Search for a task in the given section
 * @param {String} section Section name
 * @param {Object} search Array with search condition {name: value}
 */
Tasks.prototype.search = function(section, name, value) {
    if (!this.tasks.hasOwnProperty(section)) {
        return;
    }
    for(var i in this.tasks[section]) {
        var task = this.tasks[section][i];
        if (task[name] == value) {
            return task;
        }
    }
};

/**
 * Add a task into the given section
 * @param {String} section Section name
 * @param {Object} task Task to add
 */
Tasks.prototype.addTask = function(section, task) {
    if (!this.tasks.hasOwnProperty(section)) {
        this.tasks[section] = [];
    }
    task.seen = false;
    this.tasks[section].push(task);
    this.store.save();
};


/**
 * Remove a task from the given section
 * @param {String} section Section name
 * @param {Object} task Task to remove
 * @return true of false if the object was removed
 */
Tasks.prototype.removeTask = function(section, task) {
    if (!this.tasks.hasOwnProperty(section)) {
        return;
    }
    var idx = this.tasks[section].indexOf(task);
    if (idx > -1) {
        this.tasks[section].splice(idx, 1);
        this.store.save();
        return true;
    }
};

/**
 * Get task objects for a section
 * @param {String} section Section name
 * @return {Object[]} List with the tasks.
 */
Tasks.prototype.getTasks = function(section) {
    if (this.tasks.hasOwnProperty(section)) {
        return this.tasks[section];
    }
    return [];
};

/**
 * Get the number of tasks in the given section
 * @param {String} section Section name or nothing to get all tasks
 * @return {Number} Number of tasks.
 */
Tasks.prototype.getOpenTasks = function(section) {
    if (section) {
        return self.tasks[section] ? self.tasks[section].length : 0;
    }
    var self = this;
    var nOpen = 0;
    Object.keys(this.tasks).forEach(function(section) {
        nOpen += self.tasks[section].length;
    });
    return nOpen;
};

/**
 * Clear all tasks
 */
Tasks.prototype.clear = function() {
    var self = this;
    Object.keys(this.tasks).forEach(function(section) {
        delete self.tasks[section];
    });
    this.store.save();
};

return Tasks;
});
