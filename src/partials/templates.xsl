<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

<xsl:template name="blank-view">
	<h2>Welcome to Sequel.</h2>

	<div class="block-buttons">
		<div class="btn" data-click="new-file">
			<i class="icon-new-file"></i>
			New
		</div>
		
		<div class="btn" data-click="open-filesystem">
			<i class="icon-folder-open"></i>
			Open&#8230;
		</div>

		<div class="btn disabled_" data-click="from-clipboard">
			<i class="icon-clipboard"></i>
			From clipboard
		</div>
	</div>

	<div class="block-samples" data-click="select-sample">
		<h3>Example</h3>
		<xsl:call-template name="sample-list" />
	</div>
</xsl:template>


<xsl:template name="sample-list">
	<xsl:for-each select="./Samples/*">
		<div class="sample">
			<xsl:attribute name="data-kind"><xsl:value-of select="@kind"/></xsl:attribute>
			<xsl:attribute name="data-path"><xsl:value-of select="@path"/></xsl:attribute>
			<span><xsl:value-of select="@name"/></span>
		</div>
	</xsl:for-each>
</xsl:template>


<xsl:template name="tree">
	<xsl:for-each select="./*">
		<xsl:call-template name="tree-leaf"/>
	</xsl:for-each>
</xsl:template>


<xsl:template name="tree-leaf">
	<div class="leaf">
		<xsl:if test="@state = 'expanded'">
			<xsl:attribute name="data-state">expanded</xsl:attribute>
		</xsl:if>
		<i class="icon-arrow">
			<xsl:if test="@leaf = 'end'">
				<xsl:attribute name="class">icon-blank</xsl:attribute>
			</xsl:if>
		</i>
		<i><xsl:attribute name="class"><xsl:call-template name="leaf-icon"/></xsl:attribute></i>
		<span class="name"><i><xsl:value-of select="@name"/></i></span>
	</div>
	<xsl:if test="@state = 'expanded' and count(./*) &gt; 0">
	<div class="children">
		<xsl:call-template name="tree"/>
	</div>
	</xsl:if>
</xsl:template>


<xsl:template name="leaf-icon">
	<xsl:choose>
		<xsl:when test="@type = 'file'">icon-file</xsl:when>
		<xsl:when test="@type = 'server'">icon-server</xsl:when>
		<xsl:when test="@type = 'database'">icon-database</xsl:when>
		<xsl:when test="@type = 'table'">icon-table</xsl:when>
		<xsl:when test="@type = 'database'">icon-database</xsl:when>
		<xsl:when test="@type = 'column'">icon-column</xsl:when>
		<xsl:otherwise>icon-blank</xsl:otherwise>
	</xsl:choose>
</xsl:template>


<xsl:template name="query-result">
	<table>
		<thead>
			<tr>
				<xsl:for-each select="*[1]/@*">
				<th><xsl:value-of select="name()"/></th>
				</xsl:for-each>
			</tr>
		</thead>
		<tbody>
			<xsl:for-each select="./*">
			<tr>
				<xsl:for-each select="@*">
				<td><xsl:value-of select="."/></td>
				</xsl:for-each>
			</tr>
			</xsl:for-each>
		</tbody>
	</table>
</xsl:template>

</xsl:stylesheet>