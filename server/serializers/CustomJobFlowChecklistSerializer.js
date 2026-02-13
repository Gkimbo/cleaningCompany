/**
 * CustomJobFlowChecklistSerializer
 * Serializes CustomJobFlowChecklist models for API responses
 */

class CustomJobFlowChecklistSerializer {
  /**
   * Serialize a single CustomJobFlowChecklist
   * @param {Object} checklist - CustomJobFlowChecklist instance or plain object
   * @param {Object} options - Serialization options
   * @param {boolean} options.includeFlow - Include parent flow details
   * @returns {Object} Serialized checklist
   */
  static serializeOne(checklist, options = {}) {
    if (!checklist) return null;

    const { includeFlow = false } = options;

    const data = checklist.dataValues || checklist;

    const serialized = {
      id: data.id,
      customJobFlowId: data.customJobFlowId,
      forkedFromPlatformVersion: data.forkedFromPlatformVersion,
      isForkedFromPlatform: data.forkedFromPlatformVersion != null,
      snapshotData: data.snapshotData,
      // Convenience fields for frontend
      sections: data.snapshotData?.sections || [],
      sectionNames: data.snapshotData?.sections?.map((s) => s.title) || [],
      itemCount: this.getItemCount(data.snapshotData),
      sectionCount: data.snapshotData?.sections?.length || 0,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    // Include parent flow if present and requested
    if (includeFlow && data.flow) {
      const CustomJobFlowSerializer = require("./CustomJobFlowSerializer");
      serialized.flow = CustomJobFlowSerializer.serializeOne(data.flow);
    }

    return serialized;
  }

  /**
   * Serialize an array of CustomJobFlowChecklists
   * @param {Array} checklists - Array of CustomJobFlowChecklist instances
   * @param {Object} options - Serialization options
   * @returns {Array} Serialized checklists
   */
  static serializeArray(checklists, options = {}) {
    if (!checklists || !Array.isArray(checklists)) return [];
    return checklists.map((checklist) => this.serializeOne(checklist, options));
  }

  /**
   * Serialize just the structure (for editing)
   * @param {Object} checklist - CustomJobFlowChecklist instance
   * @returns {Object} Serialized structure
   */
  static serializeStructure(checklist) {
    if (!checklist) return null;

    const data = checklist.dataValues || checklist;

    return {
      id: data.id,
      customJobFlowId: data.customJobFlowId,
      sections: data.snapshotData?.sections || [],
      itemCount: this.getItemCount(data.snapshotData),
    };
  }

  /**
   * Serialize for summary view
   * @param {Object} checklist - CustomJobFlowChecklist instance
   * @returns {Object} Serialized summary
   */
  static serializeSummary(checklist) {
    if (!checklist) return null;

    const data = checklist.dataValues || checklist;

    return {
      id: data.id,
      customJobFlowId: data.customJobFlowId,
      forkedFromPlatformVersion: data.forkedFromPlatformVersion,
      isForkedFromPlatform: data.forkedFromPlatformVersion != null,
      itemCount: this.getItemCount(data.snapshotData),
      sectionCount: data.snapshotData?.sections?.length || 0,
      sectionNames: data.snapshotData?.sections?.map((s) => s.title) || [],
    };
  }

  /**
   * Helper to get item count from snapshot data
   * @param {Object} snapshotData - The checklist snapshot data
   * @returns {number} Total item count
   */
  static getItemCount(snapshotData) {
    if (!snapshotData?.sections) return 0;
    return snapshotData.sections.reduce((count, section) => {
      return count + (section.items?.length || 0);
    }, 0);
  }
}

module.exports = CustomJobFlowChecklistSerializer;
